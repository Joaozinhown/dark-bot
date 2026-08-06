export interface GuildEvent {
    id: number;
    guildId: string;
    type: string;
    data: Readonly<Record<string, unknown>>;
}
type GuildEventListener = (event: GuildEvent) => void;
export declare function createGuildEventBus(): {
    subscribe(guildId: string, listener: GuildEventListener): () => void;
    publish(guildId: string, type: string, data: Readonly<Record<string, unknown>>): GuildEvent;
};
export type GuildEventBus = ReturnType<typeof createGuildEventBus>;
export declare const guildEventBus: {
    subscribe(guildId: string, listener: GuildEventListener): () => void;
    publish(guildId: string, type: string, data: Readonly<Record<string, unknown>>): GuildEvent;
};
export {};
//# sourceMappingURL=event-bus.d.ts.map