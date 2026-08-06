import { type CustomCommandDefinition } from './definition';
export interface InteractionContextSnapshot {
    readonly userId: string;
    readonly variables: Readonly<Record<string, string>>;
    readonly options: Readonly<Record<string, unknown>>;
}
export interface ResolvedInteractionState {
    readonly token: string;
    readonly commandId: number;
    readonly commandVersionId: number;
    readonly nodeId: string;
    readonly allowedUserId: string | null;
    readonly definition: CustomCommandDefinition;
    readonly context: InteractionContextSnapshot;
}
export declare function interactionCustomId(token: string): string;
export declare function readInteractionToken(customId: string): string | null;
export declare const customInteractionState: {
    create(input: {
        guildId: string;
        commandId: number;
        commandVersionId: number;
        nodeId: string;
        context: InteractionContextSnapshot;
        allowedUserId: string | null;
        expiresInSeconds: number;
    }): Promise<string>;
    resolve(guildId: string, token: string): Promise<ResolvedInteractionState | null>;
};
//# sourceMappingURL=interaction-state.d.ts.map