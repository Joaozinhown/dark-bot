import type { GuildPermissionService } from '../../services/guild-permission-service';
export interface DiscordOAuthGuild {
    readonly id: string;
    readonly name: string;
    readonly icon: string | null;
    readonly owner: boolean;
    readonly permissions: string;
}
export interface BotGuildProvider {
    hasGuild(guildId: string): boolean | Promise<boolean>;
}
export interface MemberRoleResolver {
    resolveRoleIds(guildId: string): Promise<readonly string[] | null>;
}
export type GuildAccessSource = 'owner' | 'manage_guild' | 'admin_role';
export type GuildCapability = 'manage_bot';
export interface AuthorizedGuild {
    readonly id: string;
    readonly name: string;
    readonly icon: string | null;
    readonly accessSource: GuildAccessSource;
    readonly capabilities: readonly GuildCapability[];
}
export interface GuildAccessService {
    listAuthorizedGuilds(oauthGuilds: readonly DiscordOAuthGuild[]): Promise<AuthorizedGuild[]>;
}
export interface GuildAccessDependencies {
    readonly botGuildProvider: BotGuildProvider;
    readonly memberRoleResolver: MemberRoleResolver;
    readonly guildPermissionService: GuildPermissionService;
}
export declare function createGuildAccessService(dependencies: GuildAccessDependencies): GuildAccessService;
//# sourceMappingURL=guild-access.d.ts.map