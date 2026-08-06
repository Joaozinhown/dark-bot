"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.poolService = void 0;
exports.createPoolService = createPoolService;
const client_1 = __importDefault(require("../database/client"));
function success(value) {
    return { ok: true, value };
}
function poolForGuild(pool, guildId) {
    return pool?.guildId === guildId ? pool : null;
}
function createPoolService(store) {
    return {
        create(guildId, nome, formato) {
            return store.createPool({ guildId, nome, formato });
        },
        async addMap(guildId, poolId, nome) {
            const pool = poolForGuild(await store.findPool(poolId), guildId);
            if (!pool)
                return { ok: false, reason: 'POOL_NOT_FOUND' };
            if (pool.mapas.some(item => item.nome.toLowerCase() === nome.toLowerCase())) {
                return { ok: false, reason: 'MAP_ALREADY_EXISTS' };
            }
            const ordem = pool.mapas.length + 1;
            await store.createMap({ poolId, nome, ordem });
            return success({ pool, ordem });
        },
        async removeMap(guildId, poolId, nome) {
            const pool = poolForGuild(await store.findPool(poolId), guildId);
            if (!pool)
                return { ok: false, reason: 'POOL_NOT_FOUND' };
            const item = pool.mapas.find(candidate => candidate.nome.toLowerCase() === nome.toLowerCase());
            if (!item)
                return { ok: false, reason: 'MAP_NOT_FOUND' };
            await store.deleteMap(item.id);
            return success({ pool });
        },
        async addKiller(guildId, poolId, nome) {
            const pool = poolForGuild(await store.findPool(poolId), guildId);
            if (!pool)
                return { ok: false, reason: 'POOL_NOT_FOUND' };
            if (pool.killers.some(item => item.nome.toLowerCase() === nome.toLowerCase())) {
                return { ok: false, reason: 'KILLER_ALREADY_EXISTS' };
            }
            const ordem = pool.killers.length + 1;
            await store.createKiller({ poolId, nome, ordem });
            return success({ pool, ordem });
        },
        async removeKiller(guildId, poolId, nome) {
            const pool = poolForGuild(await store.findPool(poolId), guildId);
            if (!pool)
                return { ok: false, reason: 'POOL_NOT_FOUND' };
            const item = pool.killers.find(candidate => candidate.nome.toLowerCase() === nome.toLowerCase());
            if (!item)
                return { ok: false, reason: 'KILLER_NOT_FOUND' };
            await store.deleteKiller(item.id);
            return success({ pool });
        },
        list(guildId) {
            return store.listActivePools(guildId);
        },
        listAll(guildId) {
            return store.listPools(guildId);
        },
        async delete(guildId, poolId) {
            const pool = poolForGuild(await store.findPool(poolId), guildId);
            if (!pool)
                return { ok: false, reason: 'POOL_NOT_FOUND' };
            await store.deletePool(poolId);
            return success({ pool });
        },
        async toggle(guildId, poolId) {
            const pool = poolForGuild(await store.findPool(poolId), guildId);
            if (!pool)
                return { ok: false, reason: 'POOL_NOT_FOUND' };
            const ativa = !pool.ativa;
            await store.setPoolActive(poolId, ativa);
            return success({ pool, ativa });
        },
    };
}
const prismaPoolStore = {
    createPool: input => client_1.default.pool.create({ data: input }),
    findPool: poolId => client_1.default.pool.findUnique({
        where: { id: poolId },
        include: { mapas: true, killers: true },
    }),
    listActivePools: guildId => client_1.default.pool.findMany({
        where: { guildId, ativa: true },
        include: {
            mapas: { orderBy: { ordem: 'asc' } },
            killers: { orderBy: { ordem: 'asc' } },
        },
        orderBy: { id: 'asc' },
    }),
    listPools: guildId => client_1.default.pool.findMany({
        where: { guildId },
        include: {
            mapas: { orderBy: { ordem: 'asc' } },
            killers: { orderBy: { ordem: 'asc' } },
        },
        orderBy: { id: 'asc' },
    }),
    createMap: input => client_1.default.poolMapa.create({ data: input }),
    deleteMap: async (itemId) => {
        await client_1.default.poolMapa.delete({ where: { id: itemId } });
    },
    createKiller: input => client_1.default.poolKiller.create({ data: input }),
    deleteKiller: async (itemId) => {
        await client_1.default.poolKiller.delete({ where: { id: itemId } });
    },
    deletePool: async (poolId) => {
        await client_1.default.pool.delete({ where: { id: poolId } });
    },
    setPoolActive: async (poolId, ativa) => {
        await client_1.default.pool.update({ where: { id: poolId }, data: { ativa } });
    },
};
exports.poolService = createPoolService(prismaPoolStore);
//# sourceMappingURL=pool-service.js.map