"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWebApp = createWebApp;
const cookie_1 = __importDefault(require("@fastify/cookie"));
const helmet_1 = __importDefault(require("@fastify/helmet"));
const rate_limit_1 = __importDefault(require("@fastify/rate-limit"));
const static_1 = __importDefault(require("@fastify/static"));
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const fastify_1 = __importStar(require("fastify"));
const zod_1 = require("zod");
const crypto_1 = require("./auth/crypto");
const discord_oauth_1 = require("./auth/discord-oauth");
const event_bus_1 = require("./realtime/event-bus");
const connection_limiter_1 = require("./realtime/connection-limiter");
const panel_actions_1 = require("./panel-actions");
const SESSION_COOKIE = 'dta_session';
const CSRF_COOKIE = 'dta_csrf';
const STATE_COOKIE = 'dta_oauth_state';
const STATE_TTL_SECONDS = 10 * 60;
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
const MAX_SSE_CONNECTIONS_PER_SESSION_GUILD = 3;
const MAX_SSE_CONNECTIONS_TOTAL = 100;
const REQUEST_BODY_LIMIT_BYTES = 512 * 1024;
const OAUTH_GUILD_CACHE_TTL_MS = 30_000;
function sendError(reply, statusCode, code, message) {
    return reply.code(statusCode).send({ success: false, data: null, error: { code, message } });
}
function sendData(reply, data) {
    return reply.send({ success: true, data, error: null });
}
function isSpaNavigation(request) {
    if (request.method !== 'GET' && request.method !== 'HEAD')
        return false;
    const pathname = new URL(request.url, 'http://localhost').pathname;
    const isReserved = pathname === '/api'
        || pathname.startsWith('/api/')
        || pathname === '/health'
        || pathname.startsWith('/health/')
        || pathname.startsWith('/assets/');
    if (isReserved || node_path_1.default.extname(pathname))
        return false;
    return request.headers.accept?.split(',').some(value => value.trim().startsWith('text/html')) ?? false;
}
async function createWebApp(options) {
    const app = (0, fastify_1.default)({
        bodyLimit: REQUEST_BODY_LIMIT_BYTES,
        trustProxy: options.config.isProduction ? 1 : false,
        logController: new fastify_1.LogController({
            disableRequestLogging: () => true,
        }),
        logger: {
            level: process.env.LOG_LEVEL ?? 'info',
            redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers.set-cookie'],
        },
    });
    const eventBus = options.eventBus ?? event_bus_1.guildEventBus;
    const oauthGuildCache = new Map();
    const oauthGuildLoads = new Map();
    const streamLimiter = (0, connection_limiter_1.createConnectionLimiter)({
        maxPerKey: MAX_SSE_CONNECTIONS_PER_SESSION_GUILD,
        maxTotal: MAX_SSE_CONNECTIONS_TOTAL,
    });
    const streamsBySession = new Map();
    const streamsByGuild = new Map();
    const secureCookies = options.config.isProduction;
    const sessionCookieOptions = {
        path: '/',
        httpOnly: true,
        secure: secureCookies,
        sameSite: 'lax',
        signed: true,
        maxAge: SESSION_TTL_SECONDS,
    };
    await app.register(cookie_1.default, { secret: options.config.cookieSecret, hook: 'onRequest' });
    await app.register(helmet_1.default, {
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
    await app.register(rate_limit_1.default, {
        global: true,
        max: 120,
        timeWindow: '1 minute',
        keyGenerator: request => request.ip,
    });
    app.setErrorHandler((error, _request, reply) => {
        const statusCode = typeof error === 'object' && error !== null && 'statusCode' in error
            ? Number(error.statusCode)
            : 500;
        if (error instanceof panel_actions_1.PanelActionError) {
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
    function readSignedCookie(request, name) {
        const value = request.cookies[name];
        if (!value)
            return null;
        const unsigned = request.unsignCookie(value);
        return unsigned.valid ? unsigned.value : null;
    }
    async function requireSession(request, reply) {
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
    async function requireCsrf(request, reply, auth) {
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
    async function fetchOAuthGuilds(auth) {
        const tokens = await options.sessions.readOAuthTokens(auth.token);
        if (!tokens)
            return null;
        try {
            return await options.oauth.getCurrentUserGuilds(tokens.accessToken);
        }
        catch (error) {
            if (!(error instanceof discord_oauth_1.DiscordOAuthError) || error.status !== 401 || !tokens.refreshToken)
                throw error;
            const latestTokens = await options.sessions.readOAuthTokens(auth.token);
            if (!latestTokens)
                return null;
            if (latestTokens.accessToken !== tokens.accessToken) {
                return options.oauth.getCurrentUserGuilds(latestTokens.accessToken);
            }
            if (!latestTokens.refreshToken)
                return null;
            const refreshed = await options.oauth.refresh(latestTokens.refreshToken);
            const replaced = await options.sessions.replaceOAuthTokens(auth.token, {
                accessToken: refreshed.accessToken,
                refreshToken: refreshed.refreshToken,
            });
            if (!replaced)
                return null;
            return options.oauth.getCurrentUserGuilds(refreshed.accessToken);
        }
    }
    async function loadOAuthGuilds(auth) {
        const cacheKey = (0, crypto_1.hashOpaqueToken)(auth.token);
        const now = Date.now();
        for (const [key, entry] of oauthGuildCache) {
            if (entry.expiresAt <= now)
                oauthGuildCache.delete(key);
        }
        const cached = oauthGuildCache.get(cacheKey);
        if (cached && cached.expiresAt > now)
            return cached.guilds;
        const pending = oauthGuildLoads.get(cacheKey);
        if (pending)
            return pending;
        const operation = fetchOAuthGuilds(auth).then(async (guilds) => {
            const isSessionActive = Boolean(await options.sessions.readOAuthTokens(auth.token));
            if (guilds && isSessionActive) {
                oauthGuildCache.set(cacheKey, {
                    guilds,
                    expiresAt: Date.now() + OAUTH_GUILD_CACHE_TTL_MS,
                });
            }
            return guilds;
        });
        oauthGuildLoads.set(cacheKey, operation);
        try {
            return await operation;
        }
        finally {
            oauthGuildLoads.delete(cacheKey);
        }
    }
    async function listAuthorizedGuilds(auth) {
        const oauthGuilds = await loadOAuthGuilds(auth);
        if (!oauthGuilds)
            return [];
        return options.runtime.listAuthorizedGuilds(auth.session.userId, oauthGuilds);
    }
    async function requireGuild(request, reply) {
        const auth = await requireSession(request, reply);
        if (!auth)
            return null;
        const guildId = request.params.guildId;
        if (!(await options.runtime.hasGuildAccess(auth.session.userId, guildId))) {
            sendError(reply, 403, 'GUILD_FORBIDDEN', 'Acesso ao servidor negado.');
            return null;
        }
        return { auth, guildId };
    }
    function registerStream(registry, key, close) {
        const streams = registry.get(key) ?? new Set();
        streams.add(close);
        registry.set(key, streams);
        return () => {
            const current = registry.get(key);
            if (!current)
                return;
            current.delete(close);
            if (current.size === 0)
                registry.delete(key);
        };
    }
    function closeRegisteredStreams(registry, key) {
        for (const close of [...(registry.get(key) ?? [])])
            close();
    }
    app.get('/health', { config: { rateLimit: false } }, async (_request, reply) => sendData(reply, {
        status: options.runtime.isReady() ? 'ready' : 'starting',
        botReady: options.runtime.isReady(),
        guildCount: options.runtime.getGuildCount(),
        commandCount: options.runtime.getCommandCount?.() ?? 0,
        uptimeSeconds: Math.floor(process.uptime()),
    }));
    app.get('/api/auth/login', {
        config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    }, async (_request, reply) => {
        const state = (0, crypto_1.createOpaqueToken)().token;
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
        const parsed = zod_1.z.object({ code: zod_1.z.string().min(1), state: zod_1.z.string().min(1) }).safeParse(request.query);
        const expectedState = readSignedCookie(request, STATE_COOKIE);
        reply.clearCookie(STATE_COOKIE, { path: '/api/auth/callback' });
        if (!parsed.success || !expectedState
            || !(0, crypto_1.verifyOpaqueToken)(parsed.data.state, (0, crypto_1.hashOpaqueToken)(expectedState))) {
            return sendError(reply, 400, 'OAUTH_STATE_INVALID', 'Estado OAuth invalido.');
        }
        const tokens = await options.oauth.exchangeCode(parsed.data.code);
        const user = await options.oauth.getCurrentUser(tokens.accessToken);
        const oauthGuilds = await options.oauth.getCurrentUserGuilds(tokens.accessToken);
        const authorizedGuilds = await options.runtime.listAuthorizedGuilds(user.id, oauthGuilds);
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
        if (!auth || !(await requireCsrf(request, reply, auth)))
            return reply;
        await options.sessions.revoke(auth.token);
        const sessionKey = (0, crypto_1.hashOpaqueToken)(auth.token);
        oauthGuildCache.delete(sessionKey);
        closeRegisteredStreams(streamsBySession, sessionKey);
        reply.clearCookie(SESSION_COOKIE, { path: '/' });
        reply.clearCookie(CSRF_COOKIE, { path: '/' });
        return reply.code(204).send();
    });
    app.get('/api/guilds', async (request, reply) => {
        const auth = await requireSession(request, reply);
        return auth ? sendData(reply, await listAuthorizedGuilds(auth)) : reply;
    });
    const guildReads = [
        ['overview', guildId => options.runtime.getOverview(guildId)],
        ['confrontations', guildId => options.runtime.getRecentConfrontations(guildId)],
        ['pools', guildId => options.runtime.getPools(guildId)],
        ['ranking', guildId => options.runtime.getRanking(guildId)],
        ['teams', guildId => options.runtime.getTeams(guildId)],
        ['commands', guildId => options.runtime.getCommands(guildId)],
        ['audit', guildId => options.runtime.getAudit(guildId)],
        ['pool-details', guildId => options.runtime.getPoolDetails(guildId)],
        ['management', guildId => options.runtime.getManagement(guildId)],
        ['logs', guildId => options.runtime.getLogs(guildId)],
    ];
    for (const [resource, load] of guildReads) {
        app.get(`/api/guilds/:guildId/${resource}`, async (request, reply) => {
            const access = await requireGuild(request, reply);
            return access ? sendData(reply, await load(access.guildId)) : reply;
        });
    }
    app.post('/api/guilds/:guildId/actions', {
        config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    }, async (request, reply) => {
        const access = await requireGuild(request, reply);
        if (!access || !(await requireCsrf(request, reply, access.auth)))
            return reply;
        const parsed = panel_actions_1.panelActionSchema.safeParse(request.body);
        if (!parsed.success) {
            return sendError(reply, 400, 'VALIDATION_ERROR', 'Dados da acao invalidos.');
        }
        if (parsed.data.type === 'command.clone'
            && !(await options.runtime.hasGuildAccess(access.auth.session.userId, parsed.data.targetGuildId))) {
            return sendError(reply, 403, 'TARGET_GUILD_FORBIDDEN', 'Acesso ao servidor de destino negado.');
        }
        const result = await options.runtime.executeAction(access.guildId, access.auth.session.userId, parsed.data);
        if (parsed.data.type === 'permission.set-admin-roles') {
            closeRegisteredStreams(streamsByGuild, access.guildId);
        }
        return sendData(reply, result);
    });
    app.get('/api/guilds/:guildId/events', async (request, reply) => {
        const access = await requireGuild(request, reply);
        if (!access)
            return reply;
        const streamAuth = access.auth;
        const streamGuildId = access.guildId;
        const streamSessionId = (0, crypto_1.hashOpaqueToken)(streamAuth.token);
        const acquiredConnection = streamLimiter.acquire(`${streamSessionId}:${streamGuildId}`);
        if (!acquiredConnection) {
            return sendError(reply, 429, 'SSE_LIMIT_REACHED', 'Limite de conexoes em tempo real atingido.');
        }
        const releaseConnection = acquiredConnection;
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
        let heartbeat;
        let authorizationTimer;
        let unregisterSession = () => { };
        let unregisterGuild = () => { };
        function closeStream() {
            if (isClosed)
                return;
            isClosed = true;
            if (heartbeat)
                clearInterval(heartbeat);
            if (authorizationTimer)
                clearTimeout(authorizationTimer);
            unsubscribe();
            unregisterSession();
            unregisterGuild();
            releaseConnection();
            reply.raw.end();
        }
        async function revalidateAuthorization() {
            try {
                const currentSession = await options.sessions.resolve(streamAuth.token);
                if (!currentSession)
                    return closeStream();
                const hasAccess = await options.runtime.hasGuildAccess(currentSession.userId, streamGuildId);
                if (!hasAccess)
                    return closeStream();
            }
            catch {
                return closeStream();
            }
            if (!isClosed)
                authorizationTimer = setTimeout(revalidateAuthorization, 60_000);
        }
        heartbeat = setInterval(() => {
            if (!reply.raw.destroyed)
                reply.raw.write(': heartbeat\n\n');
        }, 20_000);
        unregisterSession = registerStream(streamsBySession, streamSessionId, closeStream);
        unregisterGuild = registerStream(streamsByGuild, streamGuildId, closeStream);
        authorizationTimer = setTimeout(revalidateAuthorization, 60_000);
        request.raw.on('close', closeStream);
        return reply;
    });
    const panelRoot = options.panelRoot ?? node_path_1.default.resolve(process.cwd(), 'panel', 'dist');
    const hasFrontendBuild = (0, node_fs_1.existsSync)(node_path_1.default.join(panelRoot, 'index.html'));
    if (hasFrontendBuild) {
        await app.register(static_1.default, {
            root: panelRoot,
            wildcard: false,
            maxAge: '30d',
            immutable: true,
            setHeaders(response, filePath) {
                if (node_path_1.default.basename(filePath) === 'index.html') {
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
//# sourceMappingURL=server.js.map