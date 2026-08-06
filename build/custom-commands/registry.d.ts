import { type Guild } from 'discord.js';
import { type CommandRegistrationState, type NativeCommandSource } from './service';
export declare const ADMIN_COMMAND_NAMES: Set<string>;
export declare function createNativeCommandSources(payloads: readonly unknown[]): NativeCommandSource[];
export declare function buildGuildCommandPayloads(guildId: string, nativePayloads: readonly unknown[]): Promise<{
    payloads: unknown[];
    dynamicByName: Map<string, number>;
}>;
export declare function composeGuildCommandPayloads(guildId: string, nativePayloads: readonly unknown[], registrations: readonly CommandRegistrationState[]): {
    payloads: unknown[];
    dynamicByName: Map<string, number>;
};
export declare function syncGuildCommandCatalog(token: string, clientId: string, guild: Guild, nativePayloads: readonly unknown[]): Promise<number>;
//# sourceMappingURL=registry.d.ts.map