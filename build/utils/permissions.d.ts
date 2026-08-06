import { GuildMember } from 'discord.js';
export declare const guildPermissionService: import("../services/guild-permission-service").GuildPermissionService;
export declare function hasOrganizationPermission(member: GuildMember): boolean;
export declare function getAdminRoleIds(guildId: string): Promise<string[]>;
export declare function setAdminRoleIds(guildId: string, roleIds: string[]): Promise<void>;
export declare function hasBotAdminPermission(member: GuildMember): Promise<boolean>;
export declare function hasCaptainPermission(member: GuildMember, teamRoleId: string): boolean;
export declare function hasPlayerPermission(member: GuildMember, teamRoleId: string): boolean;
export declare function canAccessChannel(member: GuildMember, allowedRoleIds: string[]): boolean;
export declare function parseHexColor(hex: string): number | null;
//# sourceMappingURL=permissions.d.ts.map