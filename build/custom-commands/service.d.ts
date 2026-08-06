import type { CustomCommand, CustomCommandVersion } from '@prisma/client';
import { containsScript, type CustomCommandDefinition } from './definition';
export declare const ARCHIVED_COMMAND_STATUSES: readonly ["archived", "factory_restored"];
export declare class CustomCommandError extends Error {
    readonly code: string;
    readonly statusCode: number;
    constructor(code: string, message: string, statusCode?: number);
}
export interface NativeCommandSource {
    readonly payload: Record<string, unknown>;
    readonly requireBotAdmin: boolean;
}
export interface CommandVersionView {
    id: number;
    version: number;
    definition: CustomCommandDefinition;
    publishedById: string;
    criadoEm: Date;
}
export interface CommandCatalogItem {
    id: number | null;
    stableKey: string;
    sourceType: 'native' | 'custom';
    factoryCommandName: string | null;
    name: string;
    description: string;
    definition: CustomCommandDefinition;
    enabled: boolean;
    status: string;
    publishedVersionId: number | null;
    discordCommandId: string | null;
    hasUnpublishedChanges: boolean;
    versions: CommandVersionView[];
    criadoEm: Date | null;
    atualizadoEm: Date | null;
}
export interface CommandRegistrationState {
    command: CustomCommand;
    version: CustomCommandVersion | null;
    definition: CustomCommandDefinition | null;
}
export interface SaveDraftInput {
    guildId: string;
    actorUserId: string;
    commandId?: number | null;
    sourceType: 'native' | 'custom';
    factoryCommandName?: string | null;
    definition: unknown;
    nativeCommands: readonly NativeCommandSource[];
}
export declare const customCommandService: {
    listCatalog(guildId: string, nativeCommands: readonly NativeCommandSource[]): Promise<CommandCatalogItem[]>;
    get(guildId: string, commandId: number): Promise<CommandCatalogItem>;
    saveDraft(input: SaveDraftInput): Promise<CommandCatalogItem>;
    publish(guildId: string, commandId: number, actorUserId: string): Promise<CommandCatalogItem>;
    rollback(guildId: string, commandId: number, versionId: number, actorUserId: string): Promise<CommandCatalogItem>;
    setEnabled(guildId: string, commandId: number, enabled: boolean, actorUserId: string): Promise<CommandCatalogItem>;
    archive(guildId: string, commandId: number, actorUserId: string): Promise<{
        id: number;
        status: string;
    }>;
    clone(sourceGuildId: string, commandId: number, targetGuildId: string, actorUserId: string, name: {
        ptBR: string;
        enUS: string;
    }, nativeCommands: readonly NativeCommandSource[]): Promise<CommandCatalogItem>;
    markSyncError(commandId: number): Promise<void>;
    setDiscordCommandId(commandId: number, discordCommandId: string | null): Promise<void>;
    listPublished(guildId: string): Promise<Array<{
        command: CustomCommand;
        version: CustomCommandVersion;
        definition: CustomCommandDefinition;
    }>>;
    listRegistrationState(guildId: string): Promise<CommandRegistrationState[]>;
    findPublishedByDiscordId(guildId: string, discordCommandId: string): Promise<{
        command: {
            versions: {
                id: number;
                criadoEm: Date;
                commandId: number;
                version: number;
                definition: string;
                publishedById: string;
            }[];
        } & {
            id: number;
            guildId: string;
            criadoEm: Date;
            name: string;
            description: string;
            factoryCommandName: string | null;
            stableKey: string;
            sourceType: string;
            draftDefinition: string;
            enabled: boolean;
            status: string;
            publishedVersionId: number | null;
            discordCommandId: string | null;
            createdByUserId: string;
            updatedByUserId: string;
            atualizadoEm: Date;
        };
        version: {
            id: number;
            criadoEm: Date;
            commandId: number;
            version: number;
            definition: string;
            publishedById: string;
        };
        definition: CustomCommandDefinition;
    } | null>;
    containsScript: typeof containsScript;
};
//# sourceMappingURL=service.d.ts.map