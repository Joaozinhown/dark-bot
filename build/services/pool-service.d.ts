export interface PoolItem {
    id: number;
    poolId: number;
    nome: string;
    ordem: number;
}
export interface PoolRecord {
    id: number;
    guildId: string;
    nome: string;
    formato: string;
    ativa: boolean;
}
export interface PoolWithItems extends PoolRecord {
    mapas: PoolItem[];
    killers: PoolItem[];
}
export interface PoolStore {
    createPool(input: {
        guildId: string;
        nome: string;
        formato: string;
    }): Promise<PoolRecord>;
    findPool(poolId: number): Promise<PoolWithItems | null>;
    listActivePools(guildId: string): Promise<PoolWithItems[]>;
    listPools(guildId: string): Promise<PoolWithItems[]>;
    createMap(input: {
        poolId: number;
        nome: string;
        ordem: number;
    }): Promise<PoolItem>;
    deleteMap(itemId: number): Promise<void>;
    createKiller(input: {
        poolId: number;
        nome: string;
        ordem: number;
    }): Promise<PoolItem>;
    deleteKiller(itemId: number): Promise<void>;
    deletePool(poolId: number): Promise<void>;
    setPoolActive(poolId: number, ativa: boolean): Promise<void>;
}
export type PoolFailure = {
    ok: false;
    reason: 'POOL_NOT_FOUND';
} | {
    ok: false;
    reason: 'MAP_ALREADY_EXISTS';
} | {
    ok: false;
    reason: 'MAP_NOT_FOUND';
} | {
    ok: false;
    reason: 'KILLER_ALREADY_EXISTS';
} | {
    ok: false;
    reason: 'KILLER_NOT_FOUND';
};
export type PoolResult<T> = {
    ok: true;
    value: T;
} | PoolFailure;
export declare function createPoolService(store: PoolStore): {
    create(guildId: string, nome: string, formato: "MD3" | "MD5"): Promise<PoolRecord>;
    addMap(guildId: string, poolId: number, nome: string): Promise<PoolResult<{
        pool: PoolWithItems;
        ordem: number;
    }>>;
    removeMap(guildId: string, poolId: number, nome: string): Promise<PoolResult<{
        pool: PoolWithItems;
    }>>;
    addKiller(guildId: string, poolId: number, nome: string): Promise<PoolResult<{
        pool: PoolWithItems;
        ordem: number;
    }>>;
    removeKiller(guildId: string, poolId: number, nome: string): Promise<PoolResult<{
        pool: PoolWithItems;
    }>>;
    list(guildId: string): Promise<PoolWithItems[]>;
    listAll(guildId: string): Promise<PoolWithItems[]>;
    delete(guildId: string, poolId: number): Promise<PoolResult<{
        pool: PoolWithItems;
    }>>;
    toggle(guildId: string, poolId: number): Promise<PoolResult<{
        pool: PoolWithItems;
        ativa: boolean;
    }>>;
};
export declare const poolService: {
    create(guildId: string, nome: string, formato: "MD3" | "MD5"): Promise<PoolRecord>;
    addMap(guildId: string, poolId: number, nome: string): Promise<PoolResult<{
        pool: PoolWithItems;
        ordem: number;
    }>>;
    removeMap(guildId: string, poolId: number, nome: string): Promise<PoolResult<{
        pool: PoolWithItems;
    }>>;
    addKiller(guildId: string, poolId: number, nome: string): Promise<PoolResult<{
        pool: PoolWithItems;
        ordem: number;
    }>>;
    removeKiller(guildId: string, poolId: number, nome: string): Promise<PoolResult<{
        pool: PoolWithItems;
    }>>;
    list(guildId: string): Promise<PoolWithItems[]>;
    listAll(guildId: string): Promise<PoolWithItems[]>;
    delete(guildId: string, poolId: number): Promise<PoolResult<{
        pool: PoolWithItems;
    }>>;
    toggle(guildId: string, poolId: number): Promise<PoolResult<{
        pool: PoolWithItems;
        ativa: boolean;
    }>>;
};
//# sourceMappingURL=pool-service.d.ts.map