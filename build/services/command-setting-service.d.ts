export interface CommandSettingRecord {
    readonly guildId: string;
    readonly commandName: string;
    readonly enabled: boolean;
    readonly updatedByUserId: string;
}
export interface CommandSettingState {
    readonly commandName: string;
    readonly enabled: boolean;
}
export interface SetCommandEnabledInput extends CommandSettingRecord {
}
export interface CommandSettingStore {
    find(guildId: string, commandName: string): Promise<CommandSettingRecord | null>;
    listByGuild(guildId: string): Promise<readonly CommandSettingRecord[]>;
    upsert(input: SetCommandEnabledInput): Promise<CommandSettingRecord>;
}
export type CommandSettingServiceErrorCode = 'COMMAND_NOT_ALLOWED';
export declare class CommandSettingServiceError extends Error {
    readonly code: CommandSettingServiceErrorCode;
    constructor(code: CommandSettingServiceErrorCode, message: string);
}
export interface CommandSettingService {
    isEnabled(guildId: string, commandName: string): Promise<boolean>;
    list(guildId: string): Promise<CommandSettingState[]>;
    setEnabled(input: SetCommandEnabledInput): Promise<CommandSettingRecord>;
}
export declare const prismaCommandSettingStore: CommandSettingStore;
export declare function createCommandSettingService(store: CommandSettingStore, allowedCommandNames: readonly string[]): CommandSettingService;
//# sourceMappingURL=command-setting-service.d.ts.map