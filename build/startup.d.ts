import { Collection, Client, Guild } from 'discord.js';
export declare function ensureDatabase(): Promise<void>;
export declare function syncGuildCommands(token: string, guild: Guild, commands: any[]): Promise<void>;
export declare function deployCommandsAuto(token: string, client?: Client): Promise<Collection<string, any>>;
export declare function syncPresetPoolsForGuild(guildId: string): Promise<void>;
export declare function seedPools(guildIds?: string[]): Promise<void>;
//# sourceMappingURL=startup.d.ts.map