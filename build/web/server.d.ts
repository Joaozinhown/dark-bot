import { type FastifyInstance } from 'fastify';
import { type DiscordOAuthGuild as OAuthGuild } from './auth/discord-oauth';
import type { EnabledPanelConfig } from './config';
import { type GuildEventBus } from './realtime/event-bus';
import type { PanelRuntime } from './runtime';
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
    readOAuthTokens(sessionToken: string): Promise<{
        accessToken: string;
        refreshToken: string | null;
    } | null>;
    replaceOAuthTokens(sessionToken: string, tokens: {
        accessToken: string;
        refreshToken: string | null;
    }): Promise<boolean>;
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
export declare function createWebApp(options: WebAppOptions): Promise<FastifyInstance>;
//# sourceMappingURL=server.d.ts.map