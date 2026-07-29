import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import { existsSync } from 'node:fs';
import path from 'node:path';
import Fastify, {
  LogController,
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
} from 'fastify';
import { z } from 'zod';
import type { AuthorizedGuild, DiscordOAuthGuild } from './authorization/guild-access';
import { createOpaqueToken, hashOpaqueToken, verifyOpaqueToken } from './auth/crypto';
import { DiscordOAuthError, type DiscordOAuthGuild as OAuthGuild } from './auth/discord-oauth';
import type { EnabledPanelConfig } from './config';
import { guildEventBus, type GuildEventBus } from './realtime/event-bus';
import { createConnectionLimiter } from './realtime/connection-limiter';
import type { PanelRuntime } from './runtime';
import { panelActionSchema, PanelActionError } from './panel-actions';

const SESSION_COOKIE = 'dta_session';
const CSRF_COOKIE = 'dta_csrf';
const STATE_COOKIE = 'dta_oauth_state';
const STATE_TTL_SECONDS = 10 * 60;
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
const MAX_SSE_CONNECTIONS_PER_SESSION_GUILD = 3;
const MAX_SSE_CONNECTIONS_TOTAL = 100;
const REQUEST_BODY_LIMIT_BYTES = 64 * 1024;

export interface OAuthClientContract {
  getAuthorizationUrl(state: string): string;
  exchangeCode(code: string): Promise<{
    accessToken: string;
    refreshToken: string;
  }>;
  refresh(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
  }>;
  getCurrentUser(accessToken: string): Promise<{
    id: string;
    username: string;
    avatar: string | null;
  }>;
  getCurrentUserGuilds(accessToken: string): Promise<OAuthGuild[]>;
}

export interface SessionServiceContract {
  create(input: {
    userId: string;
    username: string;
    avatarHash?: string | null;
    accessToken: string;
    refreshToken?: string | null;
  }): Promise<{
    sessionToken: string;
    csrfToken: string;
    session: PublicSession;
  }>;
  resolve(sessionToken: string): Promise<PublicSession | null>;
  verifyCsrf(sessionToken: string, csrfToken: string): Promise<boolean>;
  touch(sessionToken: string): Promise<PublicSession | null>;
  revoke(sessionToken: string): Promise<boolean>;
  readOAuthTokens(sessionToken: string): Promise<{ accessToken: string; refreshToken: string | null } | null>;
  replaceOAuthTokens(
    sessionToken: string,
    tokens: { accessToken: string; refreshToken: string | null },
  ): Promise<boolean>;
}

export interface PublicSession {
  userId: string;
  username: string;
  avatarHash: string | null;
  expiresAt: Date;
  lastAccessAt: Date;
}

export interface WebAppOptions {
  config: EnabledPanelConfig;
  oauth: OAuthClientContract;
  sessions: SessionServiceContract;
  runtime: PanelRuntime;
  eventBus?: GuildEventBus;
  panelRoot?: string;
}

interface AuthenticatedRequest {
  token: string;
  session: PublicSession;
}

function sendError(reply: FastifyReply, statusCode: number, code: string, message: string) {
  return reply.code(statusCode).send({ success: false, data: null, error: { code, message } });
}

function sendData(reply: FastifyReply, data: unknown) {
  return reply.send({ success: true, data, error: null });
}

function isSpaNavigation(request: FastifyRequest): boolean {
  if (request.method !== 'GET' && request.method !== 'HEAD') return false;
  const pathname = new URL(request.url, 'http://localhost').pathname;
  const isReserved = pathname === '/api'
    || pathname.startsWith('/api/')
    || pathname === '/health'
    || pathname.startsWith('/health/')
    || pathname.startsWith('/assets/');
  if (isReserved || path.extname(pathname)) return false;
  return request.headers.accept?.split(',').some(value => value.trim().startsWith('text/html')) ?? false;
}

export async function createWebApp(options: WebAppOptions): Promise<FastifyInstance> {
  const app = Fastify({
    bodyLimit: REQUEST_BODY_LIMIT_BYTES,
    trustProxy: options.config.isProduction ? 1 : false,
    logController: new LogController({
      disableRequestLogging: () => true,
    }),
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
      redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers.set-cookie'],
    },
  });
  const eventBus = options.eventBus ?? guildEventBus;
  const refreshOperations = new Map<string, Promise<OAuthGuild[] | null>>();
  const streamLimiter = createConnectionLimiter({
    maxPerKey: MAX_SSE_CONNECTIONS_PER_SESSION_GUILD,
    maxTotal: MAX_SSE_CONNECTIONS_TOTAL,
  });
  const streamsBySession = new Map<string, Set<() => void>>();
  const streamsByGuild = new Map<string, Set<() => void>>();
  const secureCookies = options.config.isProduction;
  const sessionCookieOptions = {
    path: '/',
    httpOnly: true,
    secure: secureCookies,
    sameSite: 'lax' as const,
    signed: true,
    maxAge: SESSION_TTL_SECONDS,
  };

  await app.register(cookie, { secret: options.config.cookieSecret, hook: 'onRequest' });
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https://cdn.discordapp.com'],
        connectSrc: ["'self'"],
      },
    },
  });
  await app.register(rateLimit, {
    global: true,
    max: 120,
    timeWindow: '1 minute',
    keyGenerator: request => request.ip,
  });

  app.setErrorHandler((error, _request, reply) => {
    const statusCode = typeof error === 'object' && error !== null && 'statusCode' in error
      ? Number(error.statusCode)
      : 500;
    if (error instanceof PanelActionError) {
      return sendError(reply, error.statusCode, error.code, error.message);
    }
    if (statusCode === 429) {
      return sendError(reply, 429, 'RATE_LIMITED', 'Muitas requisicoes. Tente novamente.');
    }
    if (statusCode >= 400 && statusCode < 500) {
      const code = statusCode === 413 ? 'PAYLOAD_TOO_LARGE' : 'BAD_REQUEST';
      const message = statusCode === 413 ? 'Requisicao muito grande.' : 'Requisicao invalida.';
      return sendError(reply, statusCode, code, message);
    }
    app.log.error({ err: error }, 'Web request failed');
    return sendError(reply, 500, 'INTERNAL_ERROR', 'Erro interno.');
  });

  function readSignedCookie(request: FastifyRequest, name: string): string | null {
    const value = request.cookies[name];
    if (!value) return null;
    const unsigned = request.unsignCookie(value);
    return unsigned.valid ? unsigned.value : null;
  }

  async function requireSession(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<AuthenticatedRequest | null> {
    const token = readSignedCookie(request, SESSION_COOKIE);
    if (!token) {
      sendError(reply, 401, 'UNAUTHENTICATED', 'Autenticacao necessaria.');
      return null;
    }
    const session = await options.sessions.touch(token);
    if (!session) {
      reply.clearCookie(SESSION_COOKIE, { path: '/' });
      reply.clearCookie(CSRF_COOKIE, { path: '/' });
      sendError(reply, 401, 'SESSION_EXPIRED', 'Sessao expirada.');
      return null;
    }
    return { token, session };
  }

  async function requireCsrf(
    request: FastifyRequest,
    reply: FastifyReply,
    auth: AuthenticatedRequest,
  ): Promise<boolean> {
    const cookieToken = request.cookies[CSRF_COOKIE];
    const headerToken = request.headers['x-csrf-token'];
    if (!cookieToken || typeof headerToken !== 'string' || cookieToken !== headerToken) {
      sendError(reply, 403, 'CSRF_INVALID', 'Token CSRF invalido.');
      return false;
    }
    if (!(await options.sessions.verifyCsrf(auth.token, headerToken))) {
      sendError(reply, 403, 'CSRF_INVALID', 'Token CSRF invalido.');
      return false;
    }
    return true;
  }

  async function loadOAuthGuilds(auth: AuthenticatedRequest): Promise<OAuthGuild[] | null> {
    const tokens = await options.sessions.readOAuthTokens(auth.token);
    if (!tokens) return null;
    try {
      return await options.oauth.getCurrentUserGuilds(tokens.accessToken);
    } catch (error: unknown) {
      if (!(error instanceof DiscordOAuthError) || error.status !== 401 || !tokens.refreshToken) throw error;
      const pending = refreshOperations.get(auth.token);
      if (pending) return pending;

      const operation = (async () => {
        const latestTokens = await options.sessions.readOAuthTokens(auth.token);
        if (!latestTokens) return null;
        if (latestTokens.accessToken !== tokens.accessToken) {
          return options.oauth.getCurrentUserGuilds(latestTokens.accessToken);
        }
        if (!latestTokens.refreshToken) return null;

        const refreshed = await options.oauth.refresh(latestTokens.refreshToken);
        const replaced = await options.sessions.replaceOAuthTokens(auth.token, {
          accessToken: refreshed.accessToken,
          refreshToken: refreshed.refreshToken,
        });
        if (!replaced) return null;
        return options.oauth.getCurrentUserGuilds(refreshed.accessToken);
      })();
      refreshOperations.set(auth.token, operation);
      try {
        return await operation;
      } finally {
        refreshOperations.delete(auth.token);
      }
    }
  }

  async function listAuthorizedGuilds(auth: AuthenticatedRequest): Promise<AuthorizedGuild[]> {
    const oauthGuilds = await loadOAuthGuilds(auth);
    if (!oauthGuilds) return [];
    return options.runtime.listAuthorizedGuilds(
      auth.session.userId,
      oauthGuilds as DiscordOAuthGuild[],
    );
  }

  async function requireGuild(
    request: FastifyRequest<{ Params: { guildId: string } }>,
    reply: FastifyReply,
  ): Promise<{ auth: AuthenticatedRequest; guild: AuthorizedGuild } | null> {
    const auth = await requireSession(request, reply);
    if (!auth) return null;
    const guild = (await listAuthorizedGuilds(auth)).find(item => item.id === request.params.guildId);
    if (!guild) {
      sendError(reply, 403, 'GUILD_FORBIDDEN', 'Acesso ao servidor negado.');
      return null;
    }
    return { auth, guild };
  }

  function registerStream(
    registry: Map<string, Set<() => void>>,
    key: string,
    close: () => void,
  ): () => void {
    const streams = registry.get(key) ?? new Set<() => void>();
    streams.add(close);
    registry.set(key, streams);
    return () => {
      const current = registry.get(key);
      if (!current) return;
      current.delete(close);
      if (current.size === 0) registry.delete(key);
    };
  }

  function closeRegisteredStreams(registry: Map<string, Set<() => void>>, key: string): void {
    for (const close of [...(registry.get(key) ?? [])]) close();
  }

  app.get('/health', { config: { rateLimit: false } }, async (_request, reply) => sendData(reply, {
    status: options.runtime.isReady() ? 'ready' : 'starting',
    botReady: options.runtime.isReady(),
    guildCount: options.runtime.getGuildCount(),
    uptimeSeconds: Math.floor(process.uptime()),
  }));

  app.get('/api/auth/login', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
  }, async (_request, reply) => {
    const state = createOpaqueToken().token;
    reply.setCookie(STATE_COOKIE, state, {
      path: '/api/auth/callback',
      httpOnly: true,
      secure: secureCookies,
      sameSite: 'lax',
      signed: true,
      maxAge: STATE_TTL_SECONDS,
    });
    return reply.redirect(options.oauth.getAuthorizationUrl(state));
  });

  app.get('/api/auth/callback', async (request, reply) => {
    const parsed = z.object({ code: z.string().min(1), state: z.string().min(1) }).safeParse(request.query);
    const expectedState = readSignedCookie(request, STATE_COOKIE);
    reply.clearCookie(STATE_COOKIE, { path: '/api/auth/callback' });
    if (!parsed.success || !expectedState
      || !verifyOpaqueToken(parsed.data.state, hashOpaqueToken(expectedState))) {
      return sendError(reply, 400, 'OAUTH_STATE_INVALID', 'Estado OAuth invalido.');
    }

    const tokens = await options.oauth.exchangeCode(parsed.data.code);
    const user = await options.oauth.getCurrentUser(tokens.accessToken);
    const oauthGuilds = await options.oauth.getCurrentUserGuilds(tokens.accessToken);
    const authorizedGuilds = await options.runtime.listAuthorizedGuilds(
      user.id,
      oauthGuilds as DiscordOAuthGuild[],
    );
    if (authorizedGuilds.length === 0) {
      return sendError(reply, 403, 'NO_AUTHORIZED_GUILDS', 'Nenhum servidor autorizado encontrado.');
    }
    const created = await options.sessions.create({
      userId: user.id,
      username: user.username,
      avatarHash: user.avatar,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
    reply.setCookie(SESSION_COOKIE, created.sessionToken, sessionCookieOptions);
    reply.setCookie(CSRF_COOKIE, created.csrfToken, {
      path: '/',
      httpOnly: false,
      secure: secureCookies,
      sameSite: 'strict',
      signed: false,
      maxAge: SESSION_TTL_SECONDS,
    });
    return reply.redirect('/');
  });

  app.get('/api/auth/session', async (request, reply) => {
    const auth = await requireSession(request, reply);
    return auth ? sendData(reply, auth.session) : reply;
  });

  app.post('/api/auth/logout', async (request, reply) => {
    const auth = await requireSession(request, reply);
    if (!auth || !(await requireCsrf(request, reply, auth))) return reply;
    await options.sessions.revoke(auth.token);
    closeRegisteredStreams(streamsBySession, hashOpaqueToken(auth.token));
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    reply.clearCookie(CSRF_COOKIE, { path: '/' });
    return reply.code(204).send();
  });

  app.get('/api/guilds', async (request, reply) => {
    const auth = await requireSession(request, reply);
    return auth ? sendData(reply, await listAuthorizedGuilds(auth)) : reply;
  });

  const guildReads: Array<[string, (guildId: string) => Promise<unknown>]> = [
    ['overview', guildId => options.runtime.getOverview(guildId)],
    ['confrontations', guildId => options.runtime.getRecentConfrontations(guildId)],
    ['pools', guildId => options.runtime.getPools(guildId)],
    ['ranking', guildId => options.runtime.getRanking(guildId)],
    ['teams', guildId => options.runtime.getTeams(guildId)],
    ['commands', guildId => options.runtime.getCommands(guildId)],
    ['audit', guildId => options.runtime.getAudit(guildId)],
    ['pool-details', guildId => options.runtime.getPoolDetails(guildId)],
    ['management', guildId => options.runtime.getManagement(guildId)],
  ];
  for (const [resource, load] of guildReads) {
    app.get<{ Params: { guildId: string } }>(`/api/guilds/:guildId/${resource}`, async (request, reply) => {
      const access = await requireGuild(request, reply);
      return access ? sendData(reply, await load(access.guild.id)) : reply;
    });
  }

  app.post<{ Params: { guildId: string }; Body: unknown }>('/api/guilds/:guildId/actions', {
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const access = await requireGuild(request, reply);
    if (!access || !(await requireCsrf(request, reply, access.auth))) return reply;
    const parsed = panelActionSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(reply, 400, 'VALIDATION_ERROR', 'Dados da acao invalidos.');
    }
    const result = await options.runtime.executeAction(
      access.guild.id,
      access.auth.session.userId,
      parsed.data,
    );
    if (parsed.data.type === 'permission.set-admin-roles') {
      closeRegisteredStreams(streamsByGuild, access.guild.id);
    }
    return sendData(reply, result);
  });

  app.get<{ Params: { guildId: string } }>('/api/guilds/:guildId/events', async (request, reply) => {
    const access = await requireGuild(request, reply);
    if (!access) return reply;
    const streamAuth = access.auth;
    const streamGuildId = access.guild.id;
    const streamSessionId = hashOpaqueToken(streamAuth.token);
    const acquiredConnection = streamLimiter.acquire(`${streamSessionId}:${streamGuildId}`);
    if (!acquiredConnection) {
      return sendError(reply, 429, 'SSE_LIMIT_REACHED', 'Limite de conexoes em tempo real atingido.');
    }
    const releaseConnection: () => void = acquiredConnection;

    reply.hijack();
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    reply.raw.write(': connected\n\n');
    const unsubscribe = eventBus.subscribe(streamGuildId, event => {
      if (!reply.raw.destroyed) {
        reply.raw.write(`id: ${event.id}\nevent: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`);
      }
    });
    let isClosed = false;
    let heartbeat: NodeJS.Timeout | undefined;
    let authorizationTimer: NodeJS.Timeout | undefined;
    let unregisterSession = () => {};
    let unregisterGuild = () => {};
    function closeStream() {
      if (isClosed) return;
      isClosed = true;
      if (heartbeat) clearInterval(heartbeat);
      if (authorizationTimer) clearTimeout(authorizationTimer);
      unsubscribe();
      unregisterSession();
      unregisterGuild();
      releaseConnection();
      reply.raw.end();
    }
    async function revalidateAuthorization() {
      try {
        const currentSession = await options.sessions.resolve(streamAuth.token);
        if (!currentSession) return closeStream();
        const guilds = await listAuthorizedGuilds({ token: streamAuth.token, session: currentSession });
        if (!guilds.some(guild => guild.id === streamGuildId)) return closeStream();
      } catch {
        return closeStream();
      }
      if (!isClosed) authorizationTimer = setTimeout(revalidateAuthorization, 60_000);
    }
    heartbeat = setInterval(() => {
      if (!reply.raw.destroyed) reply.raw.write(': heartbeat\n\n');
    }, 20_000);
    unregisterSession = registerStream(streamsBySession, streamSessionId, closeStream);
    unregisterGuild = registerStream(streamsByGuild, streamGuildId, closeStream);
    authorizationTimer = setTimeout(revalidateAuthorization, 60_000);
    request.raw.on('close', closeStream);
    return reply;
  });

  const panelRoot = options.panelRoot ?? path.resolve(process.cwd(), 'panel', 'dist');
  const hasFrontendBuild = existsSync(path.join(panelRoot, 'index.html'));
  if (hasFrontendBuild) {
    await app.register(fastifyStatic, {
      root: panelRoot,
      wildcard: false,
      maxAge: '30d',
      immutable: true,
      setHeaders(response, filePath) {
        if (path.basename(filePath) === 'index.html') {
          response.header('Cache-Control', 'no-cache');
        }
      },
    });
  }

  app.setNotFoundHandler((request, reply) => {
    if (hasFrontendBuild && isSpaNavigation(request)) {
      return reply.sendFile('index.html', { maxAge: 0, immutable: false });
    }
    return sendError(reply, 404, 'NOT_FOUND', 'Recurso nao encontrado.');
  });

  return app;
}
