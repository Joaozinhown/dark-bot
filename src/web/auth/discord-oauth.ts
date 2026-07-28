import { z } from 'zod';

const DISCORD_AUTHORIZE_URL = 'https://discord.com/oauth2/authorize';
const DISCORD_API_URL = 'https://discord.com/api/v10';
const OAUTH_SCOPES = ['identify', 'guilds'] as const;
const DISCORD_REQUEST_TIMEOUT_MS = 10_000;

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.literal('Bearer'),
  expires_in: z.number().int().positive(),
  refresh_token: z.string().min(1),
  scope: z.string().min(1),
});

const userResponseSchema = z.object({
  id: z.string().min(1),
  username: z.string().min(1),
  avatar: z.string().nullable(),
  global_name: z.string().nullable().optional(),
});

const guildResponseSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  icon: z.string().nullable(),
  owner: z.boolean(),
  permissions: z.string().regex(/^\d+$/),
});

const guildsResponseSchema = z.array(guildResponseSchema);

export interface DiscordOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface DiscordOAuthTokens {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  refreshToken: string;
  scopes: Array<(typeof OAUTH_SCOPES)[number]>;
}

export interface DiscordOAuthUser {
  id: string;
  username: string;
  avatar: string | null;
  globalName: string | null;
}

export interface DiscordOAuthGuild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
}

export class DiscordOAuthError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'DiscordOAuthError';
  }
}

function validateConfig(config: DiscordOAuthConfig): void {
  if (!config.clientId || !config.clientSecret) {
    throw new Error('Discord OAuth client credentials are required');
  }
  try {
    new URL(config.redirectUri);
  } catch {
    throw new Error('Discord OAuth redirect URI must be a valid URL');
  }
}

async function readJson(response: Response, operation: string): Promise<unknown> {
  if (!response.ok) {
    throw new DiscordOAuthError(`Discord ${operation} request failed`, response.status);
  }
  try {
    return await response.json();
  } catch {
    throw new DiscordOAuthError(`Discord ${operation} returned invalid JSON`, response.status);
  }
}

function mapTokens(input: unknown): DiscordOAuthTokens {
  const parsed = tokenResponseSchema.safeParse(input);
  if (!parsed.success) throw new DiscordOAuthError('Discord OAuth returned an invalid token response');

  const scopes = parsed.data.scope.split(/\s+/).filter(Boolean);
  const hasExactScopes = scopes.length === OAUTH_SCOPES.length
    && OAUTH_SCOPES.every(scope => scopes.includes(scope));
  if (!hasExactScopes || scopes.some(scope => !OAUTH_SCOPES.includes(scope as (typeof OAUTH_SCOPES)[number]))) {
    throw new DiscordOAuthError('Discord OAuth returned unexpected scopes');
  }

  return {
    accessToken: parsed.data.access_token,
    tokenType: parsed.data.token_type,
    expiresIn: parsed.data.expires_in,
    refreshToken: parsed.data.refresh_token,
    scopes: scopes as DiscordOAuthTokens['scopes'],
  };
}

export function createDiscordOAuthClient(
  config: DiscordOAuthConfig,
  fetchImpl: typeof fetch = fetch,
) {
  validateConfig(config);
  const basicAuthorization = `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`;

  async function requestTokens(body: URLSearchParams): Promise<DiscordOAuthTokens> {
    const response = await fetchImpl(`${DISCORD_API_URL}/oauth2/token`, {
      method: 'POST',
      headers: {
        authorization: basicAuthorization,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body,
      signal: AbortSignal.timeout(DISCORD_REQUEST_TIMEOUT_MS),
    });
    return mapTokens(await readJson(response, 'OAuth token'));
  }

  async function getAuthorizedResource(path: string, accessToken: string): Promise<unknown> {
    const response = await fetchImpl(`${DISCORD_API_URL}${path}`, {
      headers: { authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(DISCORD_REQUEST_TIMEOUT_MS),
    });
    return readJson(response, 'API');
  }

  return {
    getAuthorizationUrl(state: string): string {
      const url = new URL(DISCORD_AUTHORIZE_URL);
      url.search = new URLSearchParams({
        response_type: 'code',
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        scope: OAUTH_SCOPES.join(' '),
        state,
      }).toString();
      return url.toString();
    },

    exchangeCode(code: string): Promise<DiscordOAuthTokens> {
      return requestTokens(new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.redirectUri,
      }));
    },

    refresh(refreshToken: string): Promise<DiscordOAuthTokens> {
      return requestTokens(new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }));
    },

    async getCurrentUser(accessToken: string): Promise<DiscordOAuthUser> {
      const parsed = userResponseSchema.safeParse(await getAuthorizedResource('/users/@me', accessToken));
      if (!parsed.success) throw new DiscordOAuthError('Discord API returned an invalid user response');
      return {
        id: parsed.data.id,
        username: parsed.data.username,
        avatar: parsed.data.avatar,
        globalName: parsed.data.global_name ?? null,
      };
    },

    async getCurrentUserGuilds(accessToken: string): Promise<DiscordOAuthGuild[]> {
      const parsed = guildsResponseSchema.safeParse(
        await getAuthorizedResource('/users/@me/guilds', accessToken),
      );
      if (!parsed.success) throw new DiscordOAuthError('Discord API returned an invalid guild response');
      return parsed.data;
    },
  };
}
