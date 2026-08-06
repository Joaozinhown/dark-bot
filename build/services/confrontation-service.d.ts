import type { PoolFormato, VencedorTime, VetoVez } from '../types/index';
export type ConfrontationErrorCode = 'POOL_NOT_FOUND' | 'INVALID_MAP_COUNT' | 'INSUFFICIENT_KILLERS' | 'SAME_TEAM' | 'NOT_FOUND' | 'ALREADY_CLOSED' | 'INVALID_WINNER';
export declare class ConfrontationServiceError extends Error {
    readonly code: ConfrontationErrorCode;
    constructor(code: ConfrontationErrorCode, message: string);
}
export interface PoolRecord {
    id: number;
    guildId: string;
    formato: PoolFormato;
    ativa: boolean;
    mapas: string[];
    killers: string[];
}
export interface ConfrontationRecord {
    id: number;
    guildId: string;
    poolId: number;
    formato: PoolFormato;
    timeARoleId: string;
    timeBRoleId: string;
    timeAVitorias: number;
    timeBVitorias: number;
    status: string;
    currentSet: number;
    channelId: string | null;
    vozTimeAId: string | null;
    vozTimeBId: string | null;
    vencedor: VencedorTime | null;
    primeiroKiller: VetoVez | null;
    encerradoEm: Date | null;
    motivoEncerramento: string | null;
    criadoEm: Date;
}
export interface CreateConfrontationInput {
    guildId: string;
    poolId: number;
    timeARoleId: string;
    timeBRoleId: string;
    channelId: string;
}
export interface CreateConfrontationRecordInput extends CreateConfrontationInput {
    formato: PoolFormato;
    primeiroKiller: VetoVez;
    status: 'veto';
}
export interface CreatedConfrontation extends ConfrontationRecord {
    poolConfig: {
        id: number;
        formato: PoolFormato;
        mapas: string[];
        killers: string[];
    };
}
export interface ConfrontationStore {
    findPool(guildId: string, poolId: number): Promise<PoolRecord | null>;
    create(input: CreateConfrontationRecordInput): Promise<ConfrontationRecord>;
    findById(id: number, guildId: string): Promise<ConfrontationRecord | null>;
    recordResult(id: number, guildId: string, winner: VencedorTime): Promise<ConfrontationRecord | null>;
    close(id: number, guildId: string, reason: string | null, closedAt: Date): Promise<ConfrontationRecord | null>;
    listActive(guildId: string): Promise<ConfrontationRecord[]>;
}
export declare const prismaConfrontationStore: ConfrontationStore;
export declare function createConfrontationService(store?: ConfrontationStore, random?: () => number): {
    create(input: CreateConfrontationInput, beforeCommit?: () => Promise<unknown>): Promise<CreatedConfrontation>;
    recordResult(id: number, winnerRoleId: string, guildId: string): Promise<{
        previous: ConfrontationRecord;
        updated: ConfrontationRecord;
        winner: VencedorTime;
    }>;
    close(id: number, reason: string | null, guildId: string, beforeCommit?: () => Promise<unknown>): Promise<ConfrontationRecord>;
    listActive(guildId: string): Promise<ConfrontationRecord[]>;
};
export declare const confrontationService: {
    create(input: CreateConfrontationInput, beforeCommit?: () => Promise<unknown>): Promise<CreatedConfrontation>;
    recordResult(id: number, winnerRoleId: string, guildId: string): Promise<{
        previous: ConfrontationRecord;
        updated: ConfrontationRecord;
        winner: VencedorTime;
    }>;
    close(id: number, reason: string | null, guildId: string, beforeCommit?: () => Promise<unknown>): Promise<ConfrontationRecord>;
    listActive(guildId: string): Promise<ConfrontationRecord[]>;
};
//# sourceMappingURL=confrontation-service.d.ts.map