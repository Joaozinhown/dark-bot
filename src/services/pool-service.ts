import prisma from '../database/client';

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
  createPool(input: { guildId: string; nome: string; formato: string }): Promise<PoolRecord>;
  findPool(poolId: number): Promise<PoolWithItems | null>;
  listActivePools(guildId: string): Promise<PoolWithItems[]>;
  listPools(guildId: string): Promise<PoolWithItems[]>;
  createMap(input: { poolId: number; nome: string; ordem: number }): Promise<PoolItem>;
  deleteMap(itemId: number): Promise<void>;
  createKiller(input: { poolId: number; nome: string; ordem: number }): Promise<PoolItem>;
  deleteKiller(itemId: number): Promise<void>;
  deletePool(poolId: number): Promise<void>;
  setPoolActive(poolId: number, ativa: boolean): Promise<void>;
}

export type PoolFailure =
  | { ok: false; reason: 'POOL_NOT_FOUND' }
  | { ok: false; reason: 'MAP_ALREADY_EXISTS' }
  | { ok: false; reason: 'MAP_NOT_FOUND' }
  | { ok: false; reason: 'KILLER_ALREADY_EXISTS' }
  | { ok: false; reason: 'KILLER_NOT_FOUND' };

export type PoolResult<T> = { ok: true; value: T } | PoolFailure;

function success<T>(value: T): PoolResult<T> {
  return { ok: true, value };
}

function poolForGuild(pool: PoolWithItems | null, guildId: string): PoolWithItems | null {
  return pool?.guildId === guildId ? pool : null;
}

export function createPoolService(store: PoolStore) {
  return {
    create(guildId: string, nome: string, formato: 'MD3' | 'MD5') {
      return store.createPool({ guildId, nome, formato });
    },

    async addMap(guildId: string, poolId: number, nome: string): Promise<PoolResult<{ pool: PoolWithItems; ordem: number }>> {
      const pool = poolForGuild(await store.findPool(poolId), guildId);
      if (!pool) return { ok: false, reason: 'POOL_NOT_FOUND' };
      if (pool.mapas.some(item => item.nome.toLowerCase() === nome.toLowerCase())) {
        return { ok: false, reason: 'MAP_ALREADY_EXISTS' };
      }

      const ordem = pool.mapas.length + 1;
      await store.createMap({ poolId, nome, ordem });
      return success({ pool, ordem });
    },

    async removeMap(guildId: string, poolId: number, nome: string): Promise<PoolResult<{ pool: PoolWithItems }>> {
      const pool = poolForGuild(await store.findPool(poolId), guildId);
      if (!pool) return { ok: false, reason: 'POOL_NOT_FOUND' };

      const item = pool.mapas.find(candidate => candidate.nome.toLowerCase() === nome.toLowerCase());
      if (!item) return { ok: false, reason: 'MAP_NOT_FOUND' };

      await store.deleteMap(item.id);
      return success({ pool });
    },

    async addKiller(guildId: string, poolId: number, nome: string): Promise<PoolResult<{ pool: PoolWithItems; ordem: number }>> {
      const pool = poolForGuild(await store.findPool(poolId), guildId);
      if (!pool) return { ok: false, reason: 'POOL_NOT_FOUND' };
      if (pool.killers.some(item => item.nome.toLowerCase() === nome.toLowerCase())) {
        return { ok: false, reason: 'KILLER_ALREADY_EXISTS' };
      }

      const ordem = pool.killers.length + 1;
      await store.createKiller({ poolId, nome, ordem });
      return success({ pool, ordem });
    },

    async removeKiller(guildId: string, poolId: number, nome: string): Promise<PoolResult<{ pool: PoolWithItems }>> {
      const pool = poolForGuild(await store.findPool(poolId), guildId);
      if (!pool) return { ok: false, reason: 'POOL_NOT_FOUND' };

      const item = pool.killers.find(candidate => candidate.nome.toLowerCase() === nome.toLowerCase());
      if (!item) return { ok: false, reason: 'KILLER_NOT_FOUND' };

      await store.deleteKiller(item.id);
      return success({ pool });
    },

    list(guildId: string) {
      return store.listActivePools(guildId);
    },

    listAll(guildId: string) {
      return store.listPools(guildId);
    },

    async delete(guildId: string, poolId: number): Promise<PoolResult<{ pool: PoolWithItems }>> {
      const pool = poolForGuild(await store.findPool(poolId), guildId);
      if (!pool) return { ok: false, reason: 'POOL_NOT_FOUND' };

      await store.deletePool(poolId);
      return success({ pool });
    },

    async toggle(guildId: string, poolId: number): Promise<PoolResult<{ pool: PoolWithItems; ativa: boolean }>> {
      const pool = poolForGuild(await store.findPool(poolId), guildId);
      if (!pool) return { ok: false, reason: 'POOL_NOT_FOUND' };

      const ativa = !pool.ativa;
      await store.setPoolActive(poolId, ativa);
      return success({ pool, ativa });
    },
  };
}

const prismaPoolStore: PoolStore = {
  createPool: input => prisma.pool.create({ data: input }),
  findPool: poolId => prisma.pool.findUnique({
    where: { id: poolId },
    include: { mapas: true, killers: true },
  }),
  listActivePools: guildId => prisma.pool.findMany({
    where: { guildId, ativa: true },
    include: {
      mapas: { orderBy: { ordem: 'asc' } },
      killers: { orderBy: { ordem: 'asc' } },
    },
    orderBy: { id: 'asc' },
  }),
  listPools: guildId => prisma.pool.findMany({
    where: { guildId },
    include: {
      mapas: { orderBy: { ordem: 'asc' } },
      killers: { orderBy: { ordem: 'asc' } },
    },
    orderBy: { id: 'asc' },
  }),
  createMap: input => prisma.poolMapa.create({ data: input }),
  deleteMap: async itemId => {
    await prisma.poolMapa.delete({ where: { id: itemId } });
  },
  createKiller: input => prisma.poolKiller.create({ data: input }),
  deleteKiller: async itemId => {
    await prisma.poolKiller.delete({ where: { id: itemId } });
  },
  deletePool: async poolId => {
    await prisma.pool.delete({ where: { id: poolId } });
  },
  setPoolActive: async (poolId, ativa) => {
    await prisma.pool.update({ where: { id: poolId }, data: { ativa } });
  },
};

export const poolService = createPoolService(prismaPoolStore);
