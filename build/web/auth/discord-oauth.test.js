"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = __importDefault(require("node:test"));
const discord_oauth_1 = require("./discord-oauth");
const config = {
    clientId: 'client-id',
    clientSecret: 'client-secret',
    redirectUri: 'https://panel.example.com/auth/discord/callback',
};
function jsonResponse(body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
    });
}
(0, node_test_1.default)('builds an authorization URL limited to identify and guilds', () => {
    const client = (0, discord_oauth_1.createDiscordOAuthClient)(config, async () => jsonResponse({}));
    const url = new URL(client.getAuthorizationUrl('opaque-state'));
    strict_1.default.equal(url.origin + url.pathname, 'https://discord.com/oauth2/authorize');
    strict_1.default.equal(url.searchParams.get('client_id'), config.clientId);
    strict_1.default.equal(url.searchParams.get('redirect_uri'), config.redirectUri);
    strict_1.default.equal(url.searchParams.get('response_type'), 'code');
    strict_1.default.equal(url.searchParams.get('scope'), 'identify guilds');
    strict_1.default.equal(url.searchParams.get('state'), 'opaque-state');
    strict_1.default.equal(url.searchParams.has('permissions'), false);
});
(0, node_test_1.default)('exchanges an authorization code using the Discord v10 token endpoint', async () => {
    const calls = [];
    const client = (0, discord_oauth_1.createDiscordOAuthClient)(config, async (input, init) => {
        calls.push({ url: String(input), init });
        return jsonResponse({
            access_token: 'access-token',
            token_type: 'Bearer',
            expires_in: 3600,
            refresh_token: 'refresh-token',
            scope: 'identify guilds',
        });
    });
    const tokens = await client.exchangeCode('authorization-code');
    const headers = new Headers(calls[0].init?.headers);
    const body = new URLSearchParams(String(calls[0].init?.body));
    strict_1.default.equal(calls[0].url, 'https://discord.com/api/v10/oauth2/token');
    strict_1.default.equal(calls[0].init?.method, 'POST');
    strict_1.default.equal(headers.get('authorization'), `Basic ${Buffer.from('client-id:client-secret').toString('base64')}`);
    strict_1.default.equal(body.get('grant_type'), 'authorization_code');
    strict_1.default.equal(body.get('code'), 'authorization-code');
    strict_1.default.equal(body.get('redirect_uri'), config.redirectUri);
    strict_1.default.equal(body.has('client_secret'), false);
    strict_1.default.deepEqual(tokens, {
        accessToken: 'access-token',
        tokenType: 'Bearer',
        expiresIn: 3600,
        refreshToken: 'refresh-token',
        scopes: ['identify', 'guilds'],
    });
});
(0, node_test_1.default)('refreshes tokens and reads the current Discord user and guilds', async () => {
    const calls = [];
    const client = (0, discord_oauth_1.createDiscordOAuthClient)(config, async (input, init) => {
        const url = String(input);
        calls.push(url);
        if (url.endsWith('/oauth2/token')) {
            const body = new URLSearchParams(String(init?.body));
            strict_1.default.equal(body.get('grant_type'), 'refresh_token');
            strict_1.default.equal(body.get('refresh_token'), 'old-refresh-token');
            return jsonResponse({
                access_token: 'new-access-token',
                token_type: 'Bearer',
                expires_in: 7200,
                refresh_token: 'new-refresh-token',
                scope: 'guilds identify identify',
            });
        }
        if (url.endsWith('/users/@me')) {
            strict_1.default.equal(new Headers(init?.headers).get('authorization'), 'Bearer new-access-token');
            return jsonResponse({ id: '42', username: 'Matheus', avatar: null, global_name: 'Matheus' });
        }
        return jsonResponse([{ id: '99', name: 'DTA', icon: null, owner: true, permissions: '32' }]);
    });
    const refreshed = await client.refresh('old-refresh-token');
    const user = await client.getCurrentUser(refreshed.accessToken);
    const guilds = await client.getCurrentUserGuilds(refreshed.accessToken);
    strict_1.default.equal(refreshed.refreshToken, 'new-refresh-token');
    strict_1.default.deepEqual(refreshed.scopes, ['guilds', 'identify']);
    strict_1.default.deepEqual(user, { id: '42', username: 'Matheus', avatar: null, globalName: 'Matheus' });
    strict_1.default.deepEqual(guilds, [{ id: '99', name: 'DTA', icon: null, owner: true, permissions: '32' }]);
    strict_1.default.deepEqual(calls, [
        'https://discord.com/api/v10/oauth2/token',
        'https://discord.com/api/v10/users/@me',
        'https://discord.com/api/v10/users/@me/guilds',
    ]);
});
(0, node_test_1.default)('rejects malformed or failed Discord responses without leaking response secrets', async () => {
    const malformed = (0, discord_oauth_1.createDiscordOAuthClient)(config, async () => jsonResponse({ access_token: 'leaked-token' }));
    await strict_1.default.rejects(() => malformed.exchangeCode('code'), discord_oauth_1.DiscordOAuthError);
    const failed = (0, discord_oauth_1.createDiscordOAuthClient)(config, async () => jsonResponse({ error: 'invalid_grant', refresh_token: 'must-not-leak' }, 401));
    await strict_1.default.rejects(() => failed.refresh('input-secret'), error => error instanceof discord_oauth_1.DiscordOAuthError
        && !error.message.includes('must-not-leak')
        && !error.message.includes('input-secret'));
});
(0, node_test_1.default)('rejects token responses that grant scopes beyond the panel allowlist', async () => {
    const client = (0, discord_oauth_1.createDiscordOAuthClient)(config, async () => jsonResponse({
        access_token: 'access-token',
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: 'refresh-token',
        scope: 'identify guilds email',
    }));
    await strict_1.default.rejects(() => client.exchangeCode('code'), error => error instanceof discord_oauth_1.DiscordOAuthError
        && error.message === 'Discord OAuth returned unexpected scopes');
});
//# sourceMappingURL=discord-oauth.test.js.map