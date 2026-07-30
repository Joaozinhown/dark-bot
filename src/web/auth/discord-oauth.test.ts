import assert from 'node:assert/strict';
import test from 'node:test';
import { createDiscordOAuthClient, DiscordOAuthError } from './discord-oauth';

const config = {
  clientId: 'client-id',
  clientSecret: 'client-secret',
  redirectUri: 'https://panel.example.com/auth/discord/callback',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

test('builds an authorization URL limited to identify and guilds', () => {
  const client = createDiscordOAuthClient(config, async () => jsonResponse({}));
  const url = new URL(client.getAuthorizationUrl('opaque-state'));

  assert.equal(url.origin + url.pathname, 'https://discord.com/oauth2/authorize');
  assert.equal(url.searchParams.get('client_id'), config.clientId);
  assert.equal(url.searchParams.get('redirect_uri'), config.redirectUri);
  assert.equal(url.searchParams.get('response_type'), 'code');
  assert.equal(url.searchParams.get('scope'), 'identify guilds');
  assert.equal(url.searchParams.get('state'), 'opaque-state');
  assert.equal(url.searchParams.has('permissions'), false);
});

test('exchanges an authorization code using the Discord v10 token endpoint', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const client = createDiscordOAuthClient(config, async (input, init) => {
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

  assert.equal(calls[0].url, 'https://discord.com/api/v10/oauth2/token');
  assert.equal(calls[0].init?.method, 'POST');
  assert.equal(headers.get('authorization'), `Basic ${Buffer.from('client-id:client-secret').toString('base64')}`);
  assert.equal(body.get('grant_type'), 'authorization_code');
  assert.equal(body.get('code'), 'authorization-code');
  assert.equal(body.get('redirect_uri'), config.redirectUri);
  assert.equal(body.has('client_secret'), false);
  assert.deepEqual(tokens, {
    accessToken: 'access-token',
    tokenType: 'Bearer',
    expiresIn: 3600,
    refreshToken: 'refresh-token',
    scopes: ['identify', 'guilds'],
  });
});

test('refreshes tokens and reads the current Discord user and guilds', async () => {
  const calls: string[] = [];
  const client = createDiscordOAuthClient(config, async (input, init) => {
    const url = String(input);
    calls.push(url);
    if (url.endsWith('/oauth2/token')) {
      const body = new URLSearchParams(String(init?.body));
      assert.equal(body.get('grant_type'), 'refresh_token');
      assert.equal(body.get('refresh_token'), 'old-refresh-token');
      return jsonResponse({
        access_token: 'new-access-token',
        token_type: 'Bearer',
        expires_in: 7200,
        refresh_token: 'new-refresh-token',
        scope: 'guilds identify identify',
      });
    }
    if (url.endsWith('/users/@me')) {
      assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer new-access-token');
      return jsonResponse({ id: '42', username: 'Matheus', avatar: null, global_name: 'Matheus' });
    }
    return jsonResponse([{ id: '99', name: 'DTA', icon: null, owner: true, permissions: '32' }]);
  });

  const refreshed = await client.refresh('old-refresh-token');
  const user = await client.getCurrentUser(refreshed.accessToken);
  const guilds = await client.getCurrentUserGuilds(refreshed.accessToken);

  assert.equal(refreshed.refreshToken, 'new-refresh-token');
  assert.deepEqual(refreshed.scopes, ['guilds', 'identify']);
  assert.deepEqual(user, { id: '42', username: 'Matheus', avatar: null, globalName: 'Matheus' });
  assert.deepEqual(guilds, [{ id: '99', name: 'DTA', icon: null, owner: true, permissions: '32' }]);
  assert.deepEqual(calls, [
    'https://discord.com/api/v10/oauth2/token',
    'https://discord.com/api/v10/users/@me',
    'https://discord.com/api/v10/users/@me/guilds',
  ]);
});

test('rejects malformed or failed Discord responses without leaking response secrets', async () => {
  const malformed = createDiscordOAuthClient(config, async () => jsonResponse({ access_token: 'leaked-token' }));
  await assert.rejects(() => malformed.exchangeCode('code'), DiscordOAuthError);

  const failed = createDiscordOAuthClient(
    config,
    async () => jsonResponse({ error: 'invalid_grant', refresh_token: 'must-not-leak' }, 401),
  );
  await assert.rejects(
    () => failed.refresh('input-secret'),
    error => error instanceof DiscordOAuthError
      && !error.message.includes('must-not-leak')
      && !error.message.includes('input-secret'),
  );
});

test('rejects token responses that grant scopes beyond the panel allowlist', async () => {
  const client = createDiscordOAuthClient(config, async () => jsonResponse({
    access_token: 'access-token',
    token_type: 'Bearer',
    expires_in: 3600,
    refresh_token: 'refresh-token',
    scope: 'identify guilds email',
  }));

  await assert.rejects(
    () => client.exchangeCode('code'),
    error => error instanceof DiscordOAuthError
      && error.message === 'Discord OAuth returned unexpected scopes',
  );
});
