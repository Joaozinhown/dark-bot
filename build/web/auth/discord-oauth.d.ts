declare const OAUTH_SCOPES: readonly ["identify", "guilds"];
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
export declare class DiscordOAuthError extends Error {
    readonly status?: number | undefined;
    statusCode?: number;
    constructor(message: string, status?: number | undefined);
}
export declare function createDiscordOAuthClient(config: DiscordOAuthConfig, fetchImpl?: typeof fetch): {
    getAuthorizationUrl(state: string): string;
    exchangeCode(code: string): Promise<DiscordOAuthTokens>;
    refresh(refreshToken: string): Promise<DiscordOAuthTokens>;
    getCurrentUser(accessToken: string): Promise<DiscordOAuthUser>;
    getCurrentUserGuilds(accessToken: string): Promise<DiscordOAuthGuild[]>;
};
export {};
//# sourceMappingURL=discord-oauth.d.ts.map