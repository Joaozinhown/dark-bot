import { type Client, type Collection, type Guild } from 'discord.js';
import { type AuthorizedGuild, type DiscordOAuthGuild } from './authorization/guild-access';
import { type PanelAction } from './panel-actions';
interface CommandDefinition {
    data?: {
        toJSON(): {
            name?: string;
            description?: string;
        };
    };
}
interface PanelClient extends Client {
    commands?: Collection<string, CommandDefinition>;
}
export interface PanelRuntime {
    isReady(): boolean;
    getGuildCount(): number;
    getCommandCount?(): number;
    listAuthorizedGuilds(userId: string, oauthGuilds: readonly DiscordOAuthGuild[]): Promise<AuthorizedGuild[]>;
    hasGuildAccess(userId: string, guildId: string): Promise<boolean>;
    getOverview(guildId: string): Promise<unknown>;
    getRecentConfrontations(guildId: string): Promise<unknown[]>;
    getPools(guildId: string): Promise<unknown[]>;
    getRanking(guildId: string): Promise<unknown[]>;
    getTeams(guildId: string): Promise<unknown[]>;
    getCommands(guildId: string): Promise<unknown[]>;
    getAudit(guildId: string): Promise<unknown[]>;
    getPoolDetails(guildId: string): Promise<unknown[]>;
    getManagement(guildId: string): Promise<unknown>;
    getLogs(guildId: string): Promise<unknown>;
    executeAction(guildId: string, actorUserId: string, action: PanelAction): Promise<unknown>;
}
export declare function hasLiveGuildAccess(guild: Guild, userId: string): Promise<boolean>;
export declare function createPanelRuntime(client: PanelClient): PanelRuntime;
export {};
//# sourceMappingURL=runtime.d.ts.map