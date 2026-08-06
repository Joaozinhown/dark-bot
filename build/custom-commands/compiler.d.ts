import type { CustomCommandDefinition } from './definition';
export interface DiscordCommandPayload {
    name: string;
    name_localizations: Record<string, string>;
    description: string;
    description_localizations: Record<string, string>;
    options: unknown[];
    default_member_permissions: string | null;
    dm_permission: false;
    nsfw: boolean;
    type: 1;
}
export declare function compileDiscordCommand(input: unknown): DiscordCommandPayload;
export declare function createNativeFactoryDefinition(payload: Record<string, unknown>, requireBotAdmin: boolean): CustomCommandDefinition;
//# sourceMappingURL=compiler.d.ts.map