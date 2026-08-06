export interface GuildPermissionStore {
    getAdminRoleIds(guildId: string): Promise<string | null>;
    setAdminRoleIds(guildId: string, adminRoleIds: string): Promise<void>;
}
export interface GuildPermissionSubject {
    readonly guildId: string;
    readonly hasManageGuild: boolean;
    readonly roleIds: readonly string[];
}
export interface GuildPermissionService {
    listAdminRoleIds(guildId: string): Promise<string[]>;
    setAdminRoleIds(guildId: string, roleIds: readonly string[]): Promise<void>;
    addAdminRole(guildId: string, roleId: string): Promise<string[]>;
    removeAdminRole(guildId: string, roleId: string): Promise<string[]>;
    hasBotAdminPermission(subject: GuildPermissionSubject): Promise<boolean>;
}
export declare function createGuildPermissionService(store: GuildPermissionStore): GuildPermissionService;
//# sourceMappingURL=guild-permission-service.d.ts.map