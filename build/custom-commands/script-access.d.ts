export interface ScriptAccessSubject {
    readonly guildId: string;
    readonly userId: string;
    readonly roleIds: readonly string[];
    readonly isGuildOwner: boolean;
    readonly hasManageGuild: boolean;
}
export interface ScriptAccessConfig {
    readonly roleIds: string[];
    readonly userIds: string[];
    readonly updatedByUserId: string | null;
}
export declare const scriptAccessService: {
    get(guildId: string): Promise<ScriptAccessConfig>;
    set(guildId: string, roleIds: readonly string[], userIds: readonly string[], updatedByUserId: string): Promise<ScriptAccessConfig>;
    canUseScripts(subject: ScriptAccessSubject): Promise<boolean>;
    canManageConfig(subject: ScriptAccessSubject): boolean;
};
//# sourceMappingURL=script-access.d.ts.map