import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import type { EnabledPanelConfig } from './config';
import { DiscordOAuthError } from './auth/discord-oauth';
import { createWebApp, type OAuthClientContract, type PublicSession, type SessionServiceContract } from './server';
import type { PanelRuntime } from './runtime';
import { PanelActionError } from './panel-actions';

const config: EnabledPanelConfig = {
  enabled: true,
  clientId: '123456789012345678',
  clientSecret: 'secret',
  redirectUri: 'http://127.0.0.1:8080/api/auth/callback',
  cookieSecret: 'c'.repeat(32),
  encryptionKey: Buffer.alloc(32, 3),
  port: 8080,
  isProduction: false,
};

const publicSession: PublicSession = {
  userId: 'user-1',
  username: 'Matheus',
  avatarHash: null,
  expiresAt: new Date('2026-08-01T00:00:00.000Z'),
  lastAccessAt: new Date('2026-07-28T00:00:00.000Z'),
};

function createDependencies() {
  let isActive = false;
  let currentAccessToken = 'access-token';
  let currentRefreshToken = 'refresh-token';
  const oauth: OAuthClientContract = {
    getAuthorizationUrl(state) {
      return `https://discord.com/oauth2/authorize?state=${encodeURIComponent(state)}`;
    },
    async exchangeCode() {
      return { accessToken: 'access-token', refreshToken: 'refresh-token' };
    },
    async refresh() {
      return { accessToken: 'new-access-token', refreshToken: 'new-refresh-token' };
    },
    async getCurrentUser() {
      return { id: 'user-1', username: 'Matheus', avatar: null };
    },
    async getCurrentUserGuilds() {
      return [
        { id: 'guild-a', name: 'Guild A', icon: null, owner: true, permissions: '0' },
        { id: 'guild-b', name: 'Guild B', icon: null, owner: true, permissions: '0' },
      ];
    },
  };
  const sessions: SessionServiceContract = {
    async create() {
      isActive = true;
      return { sessionToken: 'session-token', csrfToken: 'csrf-token', session: publicSession };
    },
    async resolve(token) {
      return isActive && token === 'session-token' ? publicSession : null;
    },
    async touch(token) {
      return isActive && token === 'session-token' ? publicSession : null;
    },
    async verifyCsrf(token, csrf) {
      return isActive && token === 'session-token' && csrf === 'csrf-token';
    },
    async revoke(token) {
      if (!isActive || token !== 'session-token') return false;
      isActive = false;
      return true;
    },
    async readOAuthTokens(token) {
      return isActive && token === 'session-token'
        ? { accessToken: currentAccessToken, refreshToken: currentRefreshToken }
        : null;
    },
    async replaceOAuthTokens(_token, tokens) {
      currentAccessToken = tokens.accessToken;
      currentRefreshToken = tokens.refreshToken ?? currentRefreshToken;
      return true;
    },
  };
  const runtime: PanelRuntime = {
    isReady: () => true,
    getGuildCount: () => 2,
    async listAuthorizedGuilds(_userId, guilds) {
      return guilds.filter(guild => guild.id === 'guild-a').map(guild => ({
        id: guild.id,
        name: guild.name,
        icon: guild.icon,
        accessSource: 'owner' as const,
        capabilities: ['manage_bot'] as const,
      }));
    },
    async getOverview(guildId) { return { guildId }; },
    async getRecentConfrontations() { return []; },
    async getPools() { return []; },
    async getRanking() { return []; },
    async getTeams() { return []; },
    async getCommands() { return []; },
    async getAudit() { return []; },
    async getPoolDetails() { return []; },
    async getManagement() { return { roles: [], channels: [], adminRoleIds: [] }; },
    async executeAction(guildId, actorUserId, action) { return { guildId, actorUserId, action }; },
  };
  return { oauth, sessions, runtime };
}

function cookiePair(setCookie: string | string[] | undefined, name: string): string {
  const values = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const found = values.find(value => value.startsWith(`${name}=`));
  assert.ok(found, `missing ${name} cookie`);
  return found.split(';', 1)[0];
}

function cookieLine(setCookie: string | string[] | undefined, name: string): string {
  const values = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const found = values.find(value => value.startsWith(`${name}=`));
  assert.ok(found, `missing ${name} cookie`);
  return found;
}

test('exposes health without authentication and protects API reads', async () => {
  const app = await createWebApp({ config, ...createDependencies() });
  try {
    const health = await app.inject({ method: 'GET', url: '/health' });
    const guilds = await app.inject({ method: 'GET', url: '/api/guilds' });

    assert.equal(health.statusCode, 200);
    assert.equal(health.json().data.botReady, true);
    assert.equal(guilds.statusCode, 401);
    assert.equal(guilds.json().error.code, 'UNAUTHENTICATED');
  } finally {
    await app.close();
  }
});

test('preserves safe client error status for malformed JSON', async () => {
  const app = await createWebApp({ config, ...createDependencies() });
  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { 'content-type': 'application/json' },
      payload: '{',
    });

    assert.equal(response.statusCode, 400);
    assert.equal(response.json().error.code, 'BAD_REQUEST');
    assert.equal(response.json().error.message, 'Requisicao invalida.');
  } finally {
    await app.close();
  }
});

test('returns the API error envelope for unknown API routes without a frontend build', async () => {
  const app = await createWebApp({
    config,
    ...createDependencies(),
    panelRoot: path.join(tmpdir(), 'dta-panel-build-that-does-not-exist'),
  });
  try {
    const response = await app.inject({ method: 'GET', url: '/api/unknown' });

    assert.equal(response.statusCode, 404);
    assert.deepEqual(response.json(), {
      success: false,
      data: null,
      error: { code: 'NOT_FOUND', message: 'Recurso nao encontrado.' },
    });
  } finally {
    await app.close();
  }
});

test('serves the production SPA and keeps unknown API routes out of the fallback', async () => {
  const panelRoot = await mkdtemp(path.join(tmpdir(), 'dta-panel-'));
  await writeFile(path.join(panelRoot, 'index.html'), '<main>DTA panel</main>');
  const app = await createWebApp({ config, ...createDependencies(), panelRoot });
  try {
    const index = await app.inject({ method: 'GET', url: '/' });
    const clientRoute = await app.inject({
      method: 'GET',
      url: '/confrontations',
      headers: { accept: 'text/html' },
    });
    const unknownApi = await app.inject({ method: 'GET', url: '/api/unknown' });

    assert.equal(index.statusCode, 200);
    assert.match(index.body, /DTA panel/);
    assert.match(index.headers['cache-control'] ?? '', /no-cache/);
    assert.equal(clientRoute.statusCode, 200);
    assert.match(clientRoute.body, /DTA panel/);
    assert.equal(unknownApi.statusCode, 404);
    assert.equal(unknownApi.json().error.code, 'NOT_FOUND');

    for (const url of ['/api', '/api?source=test', '/assets/missing.js', '/favicon.ico', '/health/unknown']) {
      const response = await app.inject({ method: 'GET', url, headers: { accept: 'text/html' } });
      assert.equal(response.statusCode, 404, url);
      assert.equal(response.json().error.code, 'NOT_FOUND', url);
    }

    const nonNavigation = await app.inject({ method: 'GET', url: '/confrontations' });
    const unsupportedMethod = await app.inject({
      method: 'POST',
      url: '/confrontations',
      headers: { accept: 'text/html' },
    });
    assert.equal(nonNavigation.statusCode, 404);
    assert.equal(unsupportedMethod.statusCode, 404);
  } finally {
    await app.close();
    await rm(panelRoot, { recursive: true, force: true });
  }
});

test('completes OAuth state flow and isolates guild routes', async () => {
  const app = await createWebApp({ config, ...createDependencies() });
  try {
    const login = await app.inject({ method: 'GET', url: '/api/auth/login' });
    const state = new URL(login.headers.location!).searchParams.get('state');
    assert.ok(state);
    const stateCookie = cookiePair(login.headers['set-cookie'], 'dta_oauth_state');

    const callback = await app.inject({
      method: 'GET',
      url: `/api/auth/callback?code=code&state=${encodeURIComponent(state)}`,
      headers: { cookie: stateCookie },
    });
    assert.equal(callback.statusCode, 302);
    const sessionCookie = cookiePair(callback.headers['set-cookie'], 'dta_session');
    const csrfCookie = cookiePair(callback.headers['set-cookie'], 'dta_csrf');
    const cookies = `${sessionCookie}; ${csrfCookie}`;

    const guilds = await app.inject({ method: 'GET', url: '/api/guilds', headers: { cookie: cookies } });
    const allowed = await app.inject({
      method: 'GET', url: '/api/guilds/guild-a/overview', headers: { cookie: cookies },
    });
    const denied = await app.inject({
      method: 'GET', url: '/api/guilds/guild-b/overview', headers: { cookie: cookies },
    });

    assert.deepEqual(guilds.json().data.map((guild: { id: string }) => guild.id), ['guild-a']);
    assert.equal(allowed.statusCode, 200);
    assert.equal(denied.statusCode, 403);
    assert.equal(denied.json().error.code, 'GUILD_FORBIDDEN');
  } finally {
    await app.close();
  }
});

test('does not persist OAuth tokens when the user has no authorized guild', async () => {
  const dependencies = createDependencies();
  dependencies.runtime.listAuthorizedGuilds = async () => [];
  let createCalls = 0;
  const createSession = dependencies.sessions.create;
  dependencies.sessions.create = async input => {
    createCalls += 1;
    return createSession(input);
  };
  const app = await createWebApp({ config, ...dependencies });
  try {
    const login = await app.inject({ method: 'GET', url: '/api/auth/login' });
    const state = new URL(login.headers.location!).searchParams.get('state')!;
    const callback = await app.inject({
      method: 'GET',
      url: `/api/auth/callback?code=code&state=${encodeURIComponent(state)}`,
      headers: { cookie: cookiePair(login.headers['set-cookie'], 'dta_oauth_state') },
    });

    assert.equal(callback.statusCode, 403);
    assert.equal(callback.json().error.code, 'NO_AUTHORIZED_GUILDS');
    assert.equal(createCalls, 0);
  } finally {
    await app.close();
  }
});

test('sets secure production attributes on session and CSRF cookies', async () => {
  const productionConfig: EnabledPanelConfig = {
    ...config,
    redirectUri: 'https://panel.example.com/api/auth/callback',
    isProduction: true,
  };
  const app = await createWebApp({ config: productionConfig, ...createDependencies() });
  try {
    const login = await app.inject({ method: 'GET', url: '/api/auth/login' });
    const state = new URL(login.headers.location!).searchParams.get('state')!;
    const callback = await app.inject({
      method: 'GET',
      url: `/api/auth/callback?code=code&state=${encodeURIComponent(state)}`,
      headers: { cookie: cookiePair(login.headers['set-cookie'], 'dta_oauth_state') },
    });
    const sessionCookie = cookieLine(callback.headers['set-cookie'], 'dta_session');
    const csrfCookie = cookieLine(callback.headers['set-cookie'], 'dta_csrf');

    assert.match(sessionCookie, /HttpOnly/i);
    assert.match(sessionCookie, /Secure/i);
    assert.match(sessionCookie, /SameSite=Lax/i);
    assert.match(csrfCookie, /Secure/i);
    assert.match(csrfCookie, /SameSite=Strict/i);
    assert.doesNotMatch(csrfCookie, /HttpOnly/i);
  } finally {
    await app.close();
  }
});

test('requires double-submit CSRF before logout', async () => {
  const app = await createWebApp({ config, ...createDependencies() });
  try {
    const login = await app.inject({ method: 'GET', url: '/api/auth/login' });
    const state = new URL(login.headers.location!).searchParams.get('state')!;
    const callback = await app.inject({
      method: 'GET',
      url: `/api/auth/callback?code=code&state=${encodeURIComponent(state)}`,
      headers: { cookie: cookiePair(login.headers['set-cookie'], 'dta_oauth_state') },
    });
    const sessionCookie = cookiePair(callback.headers['set-cookie'], 'dta_session');
    const csrfCookie = cookiePair(callback.headers['set-cookie'], 'dta_csrf');
    const cookies = `${sessionCookie}; ${csrfCookie}`;

    const blocked = await app.inject({ method: 'POST', url: '/api/auth/logout', headers: { cookie: cookies } });
    const loggedOut = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { cookie: cookies, 'x-csrf-token': 'csrf-token' },
    });

    assert.equal(blocked.statusCode, 403);
    assert.equal(loggedOut.statusCode, 204);
  } finally {
    await app.close();
  }
});

test('validates, authorizes and protects administrative actions with CSRF', async () => {
  const app = await createWebApp({ config, ...createDependencies() });
  try {
    const login = await app.inject({ method: 'GET', url: '/api/auth/login' });
    const state = new URL(login.headers.location!).searchParams.get('state')!;
    const callback = await app.inject({
      method: 'GET',
      url: `/api/auth/callback?code=code&state=${encodeURIComponent(state)}`,
      headers: { cookie: cookiePair(login.headers['set-cookie'], 'dta_oauth_state') },
    });
    const cookies = [
      cookiePair(callback.headers['set-cookie'], 'dta_session'),
      cookiePair(callback.headers['set-cookie'], 'dta_csrf'),
    ].join('; ');
    const body = { type: 'command.set-enabled', commandName: 'ranking', enabled: false };

    const noCsrf = await app.inject({
      method: 'POST', url: '/api/guilds/guild-a/actions', headers: { cookie: cookies }, payload: body,
    });
    const malformed = await app.inject({
      method: 'POST',
      url: '/api/guilds/guild-a/actions',
      headers: { cookie: cookies, 'x-csrf-token': 'csrf-token' },
      payload: { type: 'command.create', name: 'unsafe' },
    });
    const allowed = await app.inject({
      method: 'POST',
      url: '/api/guilds/guild-a/actions',
      headers: { cookie: cookies, 'x-csrf-token': 'csrf-token' },
      payload: body,
    });
    const forbidden = await app.inject({
      method: 'POST',
      url: '/api/guilds/guild-b/actions',
      headers: { cookie: cookies, 'x-csrf-token': 'csrf-token' },
      payload: body,
    });

    assert.equal(noCsrf.statusCode, 403);
    assert.equal(malformed.statusCode, 400);
    assert.equal(malformed.json().error.code, 'VALIDATION_ERROR');
    assert.equal(allowed.statusCode, 200);
    assert.equal(allowed.json().data.actorUserId, 'user-1');
    assert.deepEqual(allowed.json().data.action, body);
    assert.equal(forbidden.statusCode, 403);
  } finally {
    await app.close();
  }
});

test('returns safe domain errors from administrative actions', async () => {
  const dependencies = createDependencies();
  dependencies.runtime.executeAction = async () => {
    throw new PanelActionError('ROLE_NOT_EDITABLE', 'O bot nao pode gerenciar este cargo.', 409);
  };
  const app = await createWebApp({ config, ...dependencies });
  try {
    const login = await app.inject({ method: 'GET', url: '/api/auth/login' });
    const state = new URL(login.headers.location!).searchParams.get('state')!;
    const callback = await app.inject({
      method: 'GET',
      url: `/api/auth/callback?code=code&state=${encodeURIComponent(state)}`,
      headers: { cookie: cookiePair(login.headers['set-cookie'], 'dta_oauth_state') },
    });
    const cookies = [
      cookiePair(callback.headers['set-cookie'], 'dta_session'),
      cookiePair(callback.headers['set-cookie'], 'dta_csrf'),
    ].join('; ');
    const response = await app.inject({
      method: 'POST',
      url: '/api/guilds/guild-a/actions',
      headers: { cookie: cookies, 'x-csrf-token': 'csrf-token' },
      payload: { type: 'team.delete', roleId: '123456789012345678' },
    });

    assert.equal(response.statusCode, 409);
    const payload = response.json();
    assert.equal(payload.error.code, 'ROLE_NOT_EDITABLE', JSON.stringify(payload));
    assert.equal(payload.error.message, 'O bot nao pode gerenciar este cargo.');
  } finally {
    await app.close();
  }
});

test('sanitizes unexpected internal errors', async () => {
  const dependencies = createDependencies();
  dependencies.runtime.getOverview = async () => {
    throw new Error('private database detail');
  };
  const app = await createWebApp({ config, ...dependencies });
  try {
    const login = await app.inject({ method: 'GET', url: '/api/auth/login' });
    const state = new URL(login.headers.location!).searchParams.get('state')!;
    const callback = await app.inject({
      method: 'GET',
      url: `/api/auth/callback?code=code&state=${encodeURIComponent(state)}`,
      headers: { cookie: cookiePair(login.headers['set-cookie'], 'dta_oauth_state') },
    });
    const cookies = [
      cookiePair(callback.headers['set-cookie'], 'dta_session'),
      cookiePair(callback.headers['set-cookie'], 'dta_csrf'),
    ].join('; ');

    const response = await app.inject({
      method: 'GET',
      url: '/api/guilds/guild-a/overview',
      headers: { cookie: cookies },
    });

    assert.equal(response.statusCode, 500);
    assert.equal(response.json().error.code, 'INTERNAL_ERROR');
    assert.equal(response.json().error.message, 'Erro interno.');
    assert.doesNotMatch(response.body, /private database detail/);
  } finally {
    await app.close();
  }
});

test('rejects an OAuth callback with a mismatched state', async () => {
  const app = await createWebApp({ config, ...createDependencies() });
  try {
    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/callback?code=code&state=wrong',
    });
    assert.equal(response.statusCode, 400);
    assert.equal(response.json().error.code, 'OAUTH_STATE_INVALID');
  } finally {
    await app.close();
  }
});

test('serializes concurrent OAuth refreshes for one session', async () => {
  const dependencies = createDependencies();
  let refreshCalls = 0;
  let expiredAccessCalls = 0;
  let callbackAuthorizationComplete = false;
  dependencies.oauth.getCurrentUserGuilds = async accessToken => {
    if (accessToken === 'access-token') {
      if (!callbackAuthorizationComplete) {
        callbackAuthorizationComplete = true;
        return [{ id: 'guild-a', name: 'Guild A', icon: null, owner: true, permissions: '0' }];
      }
      expiredAccessCalls += 1;
      if (expiredAccessCalls === 2) await new Promise(resolve => setTimeout(resolve, 50));
      throw new DiscordOAuthError('expired', 401);
    }
    return [{ id: 'guild-a', name: 'Guild A', icon: null, owner: true, permissions: '0' }];
  };
  dependencies.oauth.refresh = async () => {
    refreshCalls += 1;
    await new Promise(resolve => setTimeout(resolve, 10));
    return { accessToken: 'new-access-token', refreshToken: 'new-refresh-token' };
  };
  const app = await createWebApp({ config, ...dependencies });

  try {
    const login = await app.inject({ method: 'GET', url: '/api/auth/login' });
    const state = new URL(login.headers.location!).searchParams.get('state')!;
    const callback = await app.inject({
      method: 'GET',
      url: `/api/auth/callback?code=code&state=${encodeURIComponent(state)}`,
      headers: { cookie: cookiePair(login.headers['set-cookie'], 'dta_oauth_state') },
    });
    const cookies = [
      cookiePair(callback.headers['set-cookie'], 'dta_session'),
      cookiePair(callback.headers['set-cookie'], 'dta_csrf'),
    ].join('; ');

    const [first, second] = await Promise.all([
      app.inject({ method: 'GET', url: '/api/guilds', headers: { cookie: cookies } }),
      app.inject({ method: 'GET', url: '/api/guilds', headers: { cookie: cookies } }),
    ]);

    assert.equal(first.statusCode, 200);
    assert.equal(second.statusCode, 200);
    assert.equal(refreshCalls, 1);
  } finally {
    await app.close();
  }
});
