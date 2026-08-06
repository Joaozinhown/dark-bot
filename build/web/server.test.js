"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const promises_1 = require("node:fs/promises");
const node_os_1 = require("node:os");
const node_path_1 = __importDefault(require("node:path"));
const node_test_1 = __importDefault(require("node:test"));
const discord_oauth_1 = require("./auth/discord-oauth");
const server_1 = require("./server");
const panel_actions_1 = require("./panel-actions");
const config = {
    enabled: true,
    clientId: '123456789012345678',
    clientSecret: 'secret',
    redirectUri: 'http://127.0.0.1:8080/api/auth/callback',
    cookieSecret: 'c'.repeat(32),
    encryptionKey: Buffer.alloc(32, 3),
    port: 8080,
    isProduction: false,
};
const publicSession = {
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
    const oauth = {
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
    const sessions = {
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
            if (!isActive || token !== 'session-token')
                return false;
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
    const runtime = {
        isReady: () => true,
        getGuildCount: () => 2,
        async listAuthorizedGuilds(_userId, guilds) {
            return guilds.filter(guild => guild.id === 'guild-a').map(guild => ({
                id: guild.id,
                name: guild.name,
                icon: guild.icon,
                accessSource: 'owner',
                capabilities: ['manage_bot'],
            }));
        },
        async hasGuildAccess(_userId, guildId) {
            return guildId === 'guild-a';
        },
        async getOverview(guildId) { return { guildId }; },
        async getRecentConfrontations() { return []; },
        async getPools() { return []; },
        async getRanking() { return []; },
        async getTeams() { return []; },
        async getCommands() { return []; },
        async getAudit() { return []; },
        async getPoolDetails() { return []; },
        async getManagement() { return { roles: [], channels: [], adminRoleIds: [], scriptRoleIds: [], scriptUserIds: [], activeConfrontations: [] }; },
        async getLogs() { return { source: 'runtime', content: 'Bot online', fetchedAt: new Date().toISOString(), isExactDiscloudSnapshot: false }; },
        async executeAction(guildId, actorUserId, action) { return { guildId, actorUserId, action }; },
    };
    return { oauth, sessions, runtime };
}
function cookiePair(setCookie, name) {
    const values = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
    const found = values.find(value => value.startsWith(`${name}=`));
    strict_1.default.ok(found, `missing ${name} cookie`);
    return found.split(';', 1)[0];
}
function cookieLine(setCookie, name) {
    const values = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
    const found = values.find(value => value.startsWith(`${name}=`));
    strict_1.default.ok(found, `missing ${name} cookie`);
    return found;
}
(0, node_test_1.default)('exposes health without authentication and protects API reads', async () => {
    const app = await (0, server_1.createWebApp)({ config, ...createDependencies() });
    try {
        const health = await app.inject({ method: 'GET', url: '/health' });
        const guilds = await app.inject({ method: 'GET', url: '/api/guilds' });
        strict_1.default.equal(health.statusCode, 200);
        strict_1.default.equal(health.json().data.botReady, true);
        strict_1.default.equal(health.json().data.commandCount, 0);
        strict_1.default.equal(guilds.statusCode, 401);
        strict_1.default.equal(guilds.json().error.code, 'UNAUTHENTICATED');
    }
    finally {
        await app.close();
    }
});
(0, node_test_1.default)('preserves safe client error status for malformed JSON', async () => {
    const app = await (0, server_1.createWebApp)({ config, ...createDependencies() });
    try {
        const response = await app.inject({
            method: 'POST',
            url: '/api/auth/logout',
            headers: { 'content-type': 'application/json' },
            payload: '{',
        });
        strict_1.default.equal(response.statusCode, 400);
        strict_1.default.equal(response.json().error.code, 'BAD_REQUEST');
        strict_1.default.equal(response.json().error.message, 'Requisicao invalida.');
    }
    finally {
        await app.close();
    }
});
(0, node_test_1.default)('returns the API error envelope for unknown API routes without a frontend build', async () => {
    const app = await (0, server_1.createWebApp)({
        config,
        ...createDependencies(),
        panelRoot: node_path_1.default.join((0, node_os_1.tmpdir)(), 'dta-panel-build-that-does-not-exist'),
    });
    try {
        const response = await app.inject({ method: 'GET', url: '/api/unknown' });
        strict_1.default.equal(response.statusCode, 404);
        strict_1.default.deepEqual(response.json(), {
            success: false,
            data: null,
            error: { code: 'NOT_FOUND', message: 'Recurso nao encontrado.' },
        });
    }
    finally {
        await app.close();
    }
});
(0, node_test_1.default)('serves the production SPA and keeps unknown API routes out of the fallback', async () => {
    const panelRoot = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), 'dta-panel-'));
    await (0, promises_1.writeFile)(node_path_1.default.join(panelRoot, 'index.html'), '<main>DTA panel</main>');
    const app = await (0, server_1.createWebApp)({ config, ...createDependencies(), panelRoot });
    try {
        const index = await app.inject({ method: 'GET', url: '/' });
        const clientRoute = await app.inject({
            method: 'GET',
            url: '/confrontations',
            headers: { accept: 'text/html' },
        });
        const unknownApi = await app.inject({ method: 'GET', url: '/api/unknown' });
        strict_1.default.equal(index.statusCode, 200);
        strict_1.default.match(index.body, /DTA panel/);
        strict_1.default.match(index.headers['cache-control'] ?? '', /no-cache/);
        strict_1.default.equal(clientRoute.statusCode, 200);
        strict_1.default.match(clientRoute.body, /DTA panel/);
        strict_1.default.equal(unknownApi.statusCode, 404);
        strict_1.default.equal(unknownApi.json().error.code, 'NOT_FOUND');
        for (const url of ['/api', '/api?source=test', '/assets/missing.js', '/favicon.ico', '/health/unknown']) {
            const response = await app.inject({ method: 'GET', url, headers: { accept: 'text/html' } });
            strict_1.default.equal(response.statusCode, 404, url);
            strict_1.default.equal(response.json().error.code, 'NOT_FOUND', url);
        }
        const nonNavigation = await app.inject({ method: 'GET', url: '/confrontations' });
        const unsupportedMethod = await app.inject({
            method: 'POST',
            url: '/confrontations',
            headers: { accept: 'text/html' },
        });
        strict_1.default.equal(nonNavigation.statusCode, 404);
        strict_1.default.equal(unsupportedMethod.statusCode, 404);
    }
    finally {
        await app.close();
        await (0, promises_1.rm)(panelRoot, { recursive: true, force: true });
    }
});
(0, node_test_1.default)('completes OAuth state flow and isolates guild routes', async () => {
    const app = await (0, server_1.createWebApp)({ config, ...createDependencies() });
    try {
        const login = await app.inject({ method: 'GET', url: '/api/auth/login' });
        const state = new URL(login.headers.location).searchParams.get('state');
        strict_1.default.ok(state);
        const stateCookie = cookiePair(login.headers['set-cookie'], 'dta_oauth_state');
        const callback = await app.inject({
            method: 'GET',
            url: `/api/auth/callback?code=code&state=${encodeURIComponent(state)}`,
            headers: { cookie: stateCookie },
        });
        strict_1.default.equal(callback.statusCode, 302);
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
        strict_1.default.deepEqual(guilds.json().data.map((guild) => guild.id), ['guild-a']);
        strict_1.default.equal(allowed.statusCode, 200);
        strict_1.default.equal(denied.statusCode, 403);
        strict_1.default.equal(denied.json().error.code, 'GUILD_FORBIDDEN');
    }
    finally {
        await app.close();
    }
});
(0, node_test_1.default)('does not persist OAuth tokens when the user has no authorized guild', async () => {
    const dependencies = createDependencies();
    dependencies.runtime.listAuthorizedGuilds = async () => [];
    let createCalls = 0;
    const createSession = dependencies.sessions.create;
    dependencies.sessions.create = async (input) => {
        createCalls += 1;
        return createSession(input);
    };
    const app = await (0, server_1.createWebApp)({ config, ...dependencies });
    try {
        const login = await app.inject({ method: 'GET', url: '/api/auth/login' });
        const state = new URL(login.headers.location).searchParams.get('state');
        const callback = await app.inject({
            method: 'GET',
            url: `/api/auth/callback?code=code&state=${encodeURIComponent(state)}`,
            headers: { cookie: cookiePair(login.headers['set-cookie'], 'dta_oauth_state') },
        });
        strict_1.default.equal(callback.statusCode, 302);
        strict_1.default.ok(callback.headers.location?.startsWith('/auth-error?code=NO_AUTHORIZED_GUILDS'));
        strict_1.default.equal(createCalls, 0);
    }
    finally {
        await app.close();
    }
});
(0, node_test_1.default)('sets secure production attributes on session and CSRF cookies', async () => {
    const productionConfig = {
        ...config,
        redirectUri: 'https://panel.example.com/api/auth/callback',
        isProduction: true,
    };
    const app = await (0, server_1.createWebApp)({ config: productionConfig, ...createDependencies() });
    try {
        const login = await app.inject({ method: 'GET', url: '/api/auth/login' });
        const state = new URL(login.headers.location).searchParams.get('state');
        const callback = await app.inject({
            method: 'GET',
            url: `/api/auth/callback?code=code&state=${encodeURIComponent(state)}`,
            headers: { cookie: cookiePair(login.headers['set-cookie'], 'dta_oauth_state') },
        });
        const sessionCookie = cookieLine(callback.headers['set-cookie'], 'dta_session');
        const csrfCookie = cookieLine(callback.headers['set-cookie'], 'dta_csrf');
        strict_1.default.match(sessionCookie, /HttpOnly/i);
        strict_1.default.match(sessionCookie, /Secure/i);
        strict_1.default.match(sessionCookie, /SameSite=Lax/i);
        strict_1.default.match(csrfCookie, /Secure/i);
        strict_1.default.match(csrfCookie, /SameSite=Strict/i);
        strict_1.default.doesNotMatch(csrfCookie, /HttpOnly/i);
    }
    finally {
        await app.close();
    }
});
(0, node_test_1.default)('requires double-submit CSRF before logout', async () => {
    const app = await (0, server_1.createWebApp)({ config, ...createDependencies() });
    try {
        const login = await app.inject({ method: 'GET', url: '/api/auth/login' });
        const state = new URL(login.headers.location).searchParams.get('state');
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
        strict_1.default.equal(blocked.statusCode, 403);
        strict_1.default.equal(loggedOut.statusCode, 204);
    }
    finally {
        await app.close();
    }
});
(0, node_test_1.default)('validates, authorizes and protects administrative actions with CSRF', async () => {
    const app = await (0, server_1.createWebApp)({ config, ...createDependencies() });
    try {
        const login = await app.inject({ method: 'GET', url: '/api/auth/login' });
        const state = new URL(login.headers.location).searchParams.get('state');
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
        strict_1.default.equal(noCsrf.statusCode, 403);
        strict_1.default.equal(malformed.statusCode, 400);
        strict_1.default.equal(malformed.json().error.code, 'VALIDATION_ERROR');
        strict_1.default.equal(allowed.statusCode, 200);
        strict_1.default.equal(allowed.json().data.actorUserId, 'user-1');
        strict_1.default.deepEqual(allowed.json().data.action, body);
        strict_1.default.equal(forbidden.statusCode, 403);
    }
    finally {
        await app.close();
    }
});
(0, node_test_1.default)('returns safe domain errors from administrative actions', async () => {
    const dependencies = createDependencies();
    dependencies.runtime.executeAction = async () => {
        throw new panel_actions_1.PanelActionError('ROLE_NOT_EDITABLE', 'O bot nao pode gerenciar este cargo.', 409);
    };
    const app = await (0, server_1.createWebApp)({ config, ...dependencies });
    try {
        const login = await app.inject({ method: 'GET', url: '/api/auth/login' });
        const state = new URL(login.headers.location).searchParams.get('state');
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
        strict_1.default.equal(response.statusCode, 409);
        const payload = response.json();
        strict_1.default.equal(payload.error.code, 'ROLE_NOT_EDITABLE', JSON.stringify(payload));
        strict_1.default.equal(payload.error.message, 'O bot nao pode gerenciar este cargo.');
    }
    finally {
        await app.close();
    }
});
(0, node_test_1.default)('sanitizes unexpected internal errors', async () => {
    const dependencies = createDependencies();
    dependencies.runtime.getOverview = async () => {
        throw new Error('private database detail');
    };
    const app = await (0, server_1.createWebApp)({ config, ...dependencies });
    try {
        const login = await app.inject({ method: 'GET', url: '/api/auth/login' });
        const state = new URL(login.headers.location).searchParams.get('state');
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
        strict_1.default.equal(response.statusCode, 500);
        strict_1.default.equal(response.json().error.code, 'INTERNAL_ERROR');
        strict_1.default.equal(response.json().error.message, 'Erro interno.');
        strict_1.default.doesNotMatch(response.body, /private database detail/);
    }
    finally {
        await app.close();
    }
});
(0, node_test_1.default)('rejects an OAuth callback with a mismatched state', async () => {
    const app = await (0, server_1.createWebApp)({ config, ...createDependencies() });
    try {
        const response = await app.inject({
            method: 'GET',
            url: '/api/auth/callback?code=code&state=wrong',
        });
        strict_1.default.equal(response.statusCode, 400);
        strict_1.default.equal(response.json().error.code, 'OAUTH_STATE_INVALID');
    }
    finally {
        await app.close();
    }
});
(0, node_test_1.default)('serializes concurrent OAuth refreshes for one session', async () => {
    const dependencies = createDependencies();
    let refreshCalls = 0;
    let expiredAccessCalls = 0;
    let callbackAuthorizationComplete = false;
    dependencies.oauth.getCurrentUserGuilds = async (accessToken) => {
        if (accessToken === 'access-token') {
            if (!callbackAuthorizationComplete) {
                callbackAuthorizationComplete = true;
                return [{ id: 'guild-a', name: 'Guild A', icon: null, owner: true, permissions: '0' }];
            }
            expiredAccessCalls += 1;
            if (expiredAccessCalls === 2)
                await new Promise(resolve => setTimeout(resolve, 50));
            throw new discord_oauth_1.DiscordOAuthError('expired', 401);
        }
        return [{ id: 'guild-a', name: 'Guild A', icon: null, owner: true, permissions: '0' }];
    };
    dependencies.oauth.refresh = async () => {
        refreshCalls += 1;
        await new Promise(resolve => setTimeout(resolve, 10));
        return { accessToken: 'new-access-token', refreshToken: 'new-refresh-token' };
    };
    const app = await (0, server_1.createWebApp)({ config, ...dependencies });
    try {
        const login = await app.inject({ method: 'GET', url: '/api/auth/login' });
        const state = new URL(login.headers.location).searchParams.get('state');
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
        strict_1.default.equal(first.statusCode, 200);
        strict_1.default.equal(second.statusCode, 200);
        strict_1.default.equal(refreshCalls, 1);
    }
    finally {
        await app.close();
    }
});
(0, node_test_1.default)('persists admin roles without another OAuth guild request after panel load', async () => {
    const dependencies = createDependencies();
    let guildCalls = 0;
    let executedAction = null;
    let persistedRoleIds = [];
    dependencies.oauth.getCurrentUserGuilds = async () => {
        guildCalls += 1;
        if (guildCalls > 2)
            throw new discord_oauth_1.DiscordOAuthError('rate limited', 429);
        return [{ id: 'guild-a', name: 'Guild A', icon: null, owner: true, permissions: '0' }];
    };
    dependencies.runtime.executeAction = async (_guildId, _actorUserId, action) => {
        executedAction = action;
        if (action.type === 'permission.set-admin-roles')
            persistedRoleIds = [...action.roleIds];
        return { roleIds: persistedRoleIds };
    };
    dependencies.runtime.getManagement = async () => ({
        roles: [],
        channels: [],
        adminRoleIds: persistedRoleIds,
    });
    const app = await (0, server_1.createWebApp)({ config, ...dependencies });
    try {
        const login = await app.inject({ method: 'GET', url: '/api/auth/login' });
        const state = new URL(login.headers.location).searchParams.get('state');
        const callback = await app.inject({
            method: 'GET',
            url: `/api/auth/callback?code=code&state=${encodeURIComponent(state)}`,
            headers: { cookie: cookiePair(login.headers['set-cookie'], 'dta_oauth_state') },
        });
        const cookies = [
            cookiePair(callback.headers['set-cookie'], 'dta_session'),
            cookiePair(callback.headers['set-cookie'], 'dta_csrf'),
        ].join('; ');
        const action = { type: 'permission.set-admin-roles', roleIds: ['123456789012345678'] };
        const initialGuilds = await app.inject({
            method: 'GET',
            url: '/api/guilds',
            headers: { cookie: cookies },
        });
        const response = await app.inject({
            method: 'POST',
            url: '/api/guilds/guild-a/actions',
            headers: { cookie: cookies, 'x-csrf-token': 'csrf-token' },
            payload: action,
        });
        const management = await app.inject({
            method: 'GET',
            url: '/api/guilds/guild-a/management',
            headers: { cookie: cookies },
        });
        strict_1.default.equal(initialGuilds.statusCode, 200);
        strict_1.default.equal(response.statusCode, 200);
        strict_1.default.deepEqual(management.json().data.adminRoleIds, ['123456789012345678']);
        strict_1.default.deepEqual(executedAction, action);
        strict_1.default.equal(guildCalls, 2);
    }
    finally {
        await app.close();
    }
});
(0, node_test_1.default)('denies an action when live guild access was revoked after OAuth listing', async () => {
    const dependencies = createDependencies();
    let executed = false;
    dependencies.runtime.hasGuildAccess = async () => false;
    dependencies.runtime.executeAction = async () => {
        executed = true;
        return null;
    };
    const app = await (0, server_1.createWebApp)({ config, ...dependencies });
    try {
        const login = await app.inject({ method: 'GET', url: '/api/auth/login' });
        const state = new URL(login.headers.location).searchParams.get('state');
        const callback = await app.inject({
            method: 'GET',
            url: `/api/auth/callback?code=code&state=${encodeURIComponent(state)}`,
            headers: { cookie: cookiePair(login.headers['set-cookie'], 'dta_oauth_state') },
        });
        const cookies = [
            cookiePair(callback.headers['set-cookie'], 'dta_session'),
            cookiePair(callback.headers['set-cookie'], 'dta_csrf'),
        ].join('; ');
        const listed = await app.inject({
            method: 'GET',
            url: '/api/guilds',
            headers: { cookie: cookies },
        });
        const response = await app.inject({
            method: 'POST',
            url: '/api/guilds/guild-a/actions',
            headers: { cookie: cookies, 'x-csrf-token': 'csrf-token' },
            payload: { type: 'permission.set-admin-roles', roleIds: ['123456789012345678'] },
        });
        strict_1.default.equal(listed.statusCode, 200);
        strict_1.default.equal(response.statusCode, 403);
        strict_1.default.equal(response.json().error.code, 'GUILD_FORBIDDEN');
        strict_1.default.equal(executed, false);
    }
    finally {
        await app.close();
    }
});
//# sourceMappingURL=server.test.js.map