import { ChatInputCommandInteraction, type ButtonInteraction, type ModalSubmitInteraction, type StringSelectMenuInteraction } from 'discord.js';
import { type CustomCommandDefinition } from './definition';
type DynamicComponentInteraction = ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction;
export interface SimulationInput {
    readonly locale?: 'pt-BR' | 'en-US';
    readonly options?: Readonly<Record<string, unknown>>;
    readonly userId?: string;
    readonly username?: string;
    readonly guildId?: string;
    readonly guildName?: string;
    readonly channelId?: string;
}
export interface SimulationResult {
    readonly actions: Array<Readonly<Record<string, unknown>>>;
    readonly scriptLogs: string[];
}
export declare function canExecuteDynamicCommand(interaction: ChatInputCommandInteraction, definition: CustomCommandDefinition, commandId: number): Promise<{
    allowed: true;
} | {
    allowed: false;
    message: string;
}>;
export declare function executeDynamicCommand(interaction: ChatInputCommandInteraction, input: {
    commandId: number;
    versionId: number;
    definition: CustomCommandDefinition;
}): Promise<void>;
export declare function handleDynamicComponent(interaction: DynamicComponentInteraction): Promise<boolean>;
export declare function adaptInteractionForNativeHandler(interaction: ChatInputCommandInteraction, definition: CustomCommandDefinition, factoryCommandName: string): ChatInputCommandInteraction;
export declare function simulateDefinition(definition: CustomCommandDefinition, input?: SimulationInput): Promise<SimulationResult>;
export {};
//# sourceMappingURL=executor.d.ts.map