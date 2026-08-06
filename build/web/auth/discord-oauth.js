"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiscordOAuthError = void 0;
exports.createDiscordOAuthClient = createDiscordOAuthClient;
const zod_1 = require("zod");
const DISCORD_AUTHORIZE_URL = 'https://discord.com/oauth2/authorize';
const DISCORD_API_URL = 'https://discord.com/api/v10';
const OAUTH_SCOPES = ['identify', 'guilds'];
const DISCORD_REQUEST_TIMEOUT_MS = 10_000;
const tokenResponseSchema = zod_1.z.object({
    access_token: zod_1.z.string().min(1),
    token_type: zod_1.z.literal('Bearer'),
    expires_in: zod_1.z.number().int().positive(),
    refresh_token: zod_1.z.string().min(1),
    scope: zod_1.z.string().min(1),
});
const userResponseSchema = zod_1.z.object({
    id: zod_1.z.string().min(1),
    username: zod_1.z.string().min(1),
    avatar: zod_1.z.string().nullable(),
    global_name: zod_1.z.string().nullable().optional(),
});
const guildResponseSchema = zod_1.z.object({
    id: zod_1.z.string().min(1),
    name: zod_1.z.string().min(1),
    icon: zod_1.z.string().nullable(),
    owner: zod_1.z.boolean(),
    permissions: zod_1.z.string().regex(/^\d+$/),
});
const guildsResponseSchema = zod_1.z.array(guildResponseSchema);
class DiscordOAuthError extends Error {
    status;
    constructor(message, status) {
        super(message);
        this.status = status;
        this.name = 'DiscordOAuthError';
    }
}
exports.DiscordOAuthError = DiscordOAuthError;
function validateConfig(config) {
    if (!config.clientId || !config.clientSecret) {
        throw new Error('Discord OAuth client credentials are required');
    }
    try {
        new URL(config.redirectUri);
    }
    catch {
        throw new Error('Discord OAuth redirect URI must be a valid URL');
    }
}
async function readJson(response, operation) {
    if (!response.ok) {
        throw new DiscordOAuthError(`Discord ${operation} request failed`, response.status);
    }
    try {
        return await response.json();
    }
    catch {
        throw new DiscordOAuthError(`Discord ${operation} returned invalid JSON`, response.status);
    }
}
function mapTokens(input) {
    const parsed = tokenResponseSchema.safeParse(input);
    if (!parsed.success)
        throw new DiscordOAuthError('Discord OAuth returned an invalid token response');
    const scopes = [...new Set(parsed.data.scope.split(/\s+/).filter(Boolean))];
    const hasExactScopes = scopes.length === OAUTH_SCOPES.length
        && OAUTH_SCOPES.every(scope => scopes.includes(scope));
    if (!hasExactScopes || scopes.some(scope => !OAUTH_SCOPES.includes(scope))) {
        throw new DiscordOAuthError('Discord OAuth returned unexpected scopes');
    }
    return {
        accessToken: parsed.data.access_token,
        tokenType: parsed.data.token_type,
        expiresIn: parsed.data.expires_in,
        refreshToken: parsed.data.refresh_token,
        scopes: scopes,
    };
}
function createDiscordOAuthClient(config, fetchImpl = fetch) {
    validateConfig(config);
    const basicAuthorization = `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`;
    async function requestTokens(body) {
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
    async function getAuthorizedResource(path, accessToken) {
        const response = await fetchImpl(`${DISCORD_API_URL}${path}`, {
            headers: { authorization: `Bearer ${accessToken}` },
            signal: AbortSignal.timeout(DISCORD_REQUEST_TIMEOUT_MS),
        });
        return readJson(response, 'API');
    }
    return {
        getAuthorizationUrl(state) {
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
        exchangeCode(code) {
            return requestTokens(new URLSearchParams({
                grant_type: 'authorization_code',
                code,
                redirect_uri: config.redirectUri,
            }));
        },
        refresh(refreshToken) {
            return requestTokens(new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
            }));
        },
        async getCurrentUser(accessToken) {
            const parsed = userResponseSchema.safeParse(await getAuthorizedResource('/users/@me', accessToken));
            if (!parsed.success)
                throw new DiscordOAuthError('Discord API returned an invalid user response');
            return {
                id: parsed.data.id,
                username: parsed.data.username,
                avatar: parsed.data.avatar,
                globalName: parsed.data.global_name ?? null,
            };
        },
        async getCurrentUserGuilds(accessToken) {
            const parsed = guildsResponseSchema.safeParse(await getAuthorizedResource('/users/@me/guilds', accessToken));
            if (!parsed.success)
                throw new DiscordOAuthError('Discord API returned an invalid guild response');
            return parsed.data;
        },
    };
}
//# sourceMappingURL=discord-oauth.js.map