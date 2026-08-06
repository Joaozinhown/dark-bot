export interface PlayerRecord {
    id: string;
    guildId: string;
    nome: string;
    vitorias: number;
    derrotas: number;
    confrontos: number;
}
export interface PlayerStore {
    find(userId: string, guildId: string): Promise<PlayerRecord | null>;
    create(input: Pick<PlayerRecord, 'id' | 'guildId' | 'nome'>): Promise<PlayerRecord>;
}
export declare function createPlayerService(store: PlayerStore): {
    getOrCreate(userId: string, guildId: string, displayName: string): Promise<PlayerRecord>;
};
export declare const playerService: {
    getOrCreate(userId: string, guildId: string, displayName: string): Promise<PlayerRecord>;
};
//# sourceMappingURL=player-service.d.ts.map