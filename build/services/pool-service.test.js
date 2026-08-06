"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = __importDefault(require("node:test"));
const pool_service_1 = require("./pool-service");
function item(id, poolId, nome, ordem) {
    return { id, poolId, nome, ordem };
}
function pool(overrides = {}) {
    return {
        id: 1,
        guildId: 'guild-a',
        nome: 'Pool 1',
        formato: 'MD3',
        ativa: true,
        mapas: [],
        killers: [],
        ...overrides,
    };
}
class MemoryPoolStore {
    pools;
    nextPoolId;
    nextItemId;
    constructor(initialPools = []) {
        this.pools = structuredClone(initialPools);
        this.nextPoolId = Math.max(0, ...initialPools.map(entry => entry.id)) + 1;
        this.nextItemId = Math.max(0, ...initialPools.flatMap(entry => [...entry.mapas, ...entry.killers]).map(entry => entry.id)) + 1;
    }
    async createPool(input) {
        const created = pool({ id: this.nextPoolId++, ...input });
        this.pools = [...this.pools, created];
        return structuredClone(created);
    }
    async findPool(poolId) {
        const found = this.pools.find(entry => entry.id === poolId);
        return found ? structuredClone(found) : null;
    }
    async listActivePools(guildId) {
        return structuredClone(this.pools
            .filter(entry => entry.guildId === guildId && entry.ativa)
            .sort((left, right) => left.id - right.id)
            .map(entry => ({
            ...entry,
            mapas: [...entry.mapas].sort((left, right) => left.ordem - right.ordem),
            killers: [...entry.killers].sort((left, right) => left.ordem - right.ordem),
        })));
    }
    async listPools(guildId) {
        return structuredClone(this.pools
            .filter(entry => entry.guildId === guildId)
            .sort((left, right) => left.id - right.id));
    }
    async createMap(input) {
        const created = item(this.nextItemId++, input.poolId, input.nome, input.ordem);
        this.updateItems(input.poolId, 'mapas', entries => [...entries, created]);
        return structuredClone(created);
    }
    async deleteMap(itemId) {
        this.pools = this.pools.map(entry => ({
            ...entry,
            mapas: entry.mapas.filter(candidate => candidate.id !== itemId),
        }));
    }
    async createKiller(input) {
        const created = item(this.nextItemId++, input.poolId, input.nome, input.ordem);
        this.updateItems(input.poolId, 'killers', entries => [...entries, created]);
        return structuredClone(created);
    }
    async deleteKiller(itemId) {
        this.pools = this.pools.map(entry => ({
            ...entry,
            killers: entry.killers.filter(candidate => candidate.id !== itemId),
        }));
    }
    async deletePool(poolId) {
        this.pools = this.pools.filter(entry => entry.id !== poolId);
    }
    async setPoolActive(poolId, ativa) {
        this.pools = this.pools.map(entry => entry.id === poolId ? { ...entry, ativa } : entry);
    }
    updateItems(poolId, key, update) {
        this.pools = this.pools.map(entry => entry.id === poolId
            ? { ...entry, [key]: update(entry[key]) }
            : entry);
    }
}
(0, node_test_1.default)('creates a pool scoped to the supplied guild', async () => {
    const store = new MemoryPoolStore();
    const service = (0, pool_service_1.createPoolService)(store);
    const created = await service.create('guild-b', 'Pool nova', 'MD5');
    strict_1.default.equal(created.guildId, 'guild-b');
    strict_1.default.equal(created.nome, 'Pool nova');
    strict_1.default.equal(created.formato, 'MD5');
});
(0, node_test_1.default)('blocks pool operations from another guild', async () => {
    const store = new MemoryPoolStore([pool()]);
    const service = (0, pool_service_1.createPoolService)(store);
    strict_1.default.deepEqual(await service.addMap('guild-b', 1, 'Ormond'), { ok: false, reason: 'POOL_NOT_FOUND' });
    strict_1.default.deepEqual(await service.addKiller('guild-b', 1, 'Spirit'), { ok: false, reason: 'POOL_NOT_FOUND' });
    strict_1.default.deepEqual(await service.toggle('guild-b', 1), { ok: false, reason: 'POOL_NOT_FOUND' });
    strict_1.default.deepEqual(await service.delete('guild-b', 1), { ok: false, reason: 'POOL_NOT_FOUND' });
    strict_1.default.equal((await store.findPool(1))?.ativa, true);
});
(0, node_test_1.default)('rejects duplicate maps and killers case-insensitively', async () => {
    const store = new MemoryPoolStore([pool({
            mapas: [item(10, 1, 'Wretched Shop', 1)],
            killers: [item(11, 1, 'The First', 1)],
        })]);
    const service = (0, pool_service_1.createPoolService)(store);
    strict_1.default.deepEqual(await service.addMap('guild-a', 1, 'wReTcHeD sHoP'), {
        ok: false,
        reason: 'MAP_ALREADY_EXISTS',
    });
    strict_1.default.deepEqual(await service.addKiller('guild-a', 1, 'the first'), {
        ok: false,
        reason: 'KILLER_ALREADY_EXISTS',
    });
});
(0, node_test_1.default)('reports missing pools, maps and killers', async () => {
    const service = (0, pool_service_1.createPoolService)(new MemoryPoolStore([pool()]));
    strict_1.default.deepEqual(await service.removeMap('guild-a', 99, 'Ormond'), { ok: false, reason: 'POOL_NOT_FOUND' });
    strict_1.default.deepEqual(await service.removeKiller('guild-a', 99, 'Spirit'), { ok: false, reason: 'POOL_NOT_FOUND' });
    strict_1.default.deepEqual(await service.removeMap('guild-a', 1, 'Ormond'), { ok: false, reason: 'MAP_NOT_FOUND' });
    strict_1.default.deepEqual(await service.removeKiller('guild-a', 1, 'Spirit'), { ok: false, reason: 'KILLER_NOT_FOUND' });
});
(0, node_test_1.default)('assigns map and killer order from the current item count', async () => {
    const store = new MemoryPoolStore([pool({
            mapas: [item(10, 1, 'Mapa 1', 4), item(11, 1, 'Mapa 2', 1)],
            killers: [item(12, 1, 'Killer 1', 7)],
        })]);
    const service = (0, pool_service_1.createPoolService)(store);
    const mapResult = await service.addMap('guild-a', 1, 'Mapa 3');
    const killerResult = await service.addKiller('guild-a', 1, 'Killer 2');
    strict_1.default.equal(mapResult.ok && mapResult.value.ordem, 3);
    strict_1.default.equal(killerResult.ok && killerResult.value.ordem, 2);
    strict_1.default.deepEqual((await store.findPool(1))?.mapas.map(entry => entry.ordem), [4, 1, 3]);
    strict_1.default.deepEqual((await store.findPool(1))?.killers.map(entry => entry.ordem), [7, 2]);
});
(0, node_test_1.default)('removes matching maps and killers case-insensitively', async () => {
    const store = new MemoryPoolStore([pool({
            mapas: [item(10, 1, 'Ormond', 1)],
            killers: [item(11, 1, 'Spirit', 1)],
        })]);
    const service = (0, pool_service_1.createPoolService)(store);
    strict_1.default.equal((await service.removeMap('guild-a', 1, 'ORMOND')).ok, true);
    strict_1.default.equal((await service.removeKiller('guild-a', 1, 'spirit')).ok, true);
    strict_1.default.deepEqual((await store.findPool(1))?.mapas, []);
    strict_1.default.deepEqual((await store.findPool(1))?.killers, []);
});
(0, node_test_1.default)('lists only active guild pools ordered by pool and item order', async () => {
    const store = new MemoryPoolStore([
        pool({ id: 3, nome: 'Terceira', mapas: [item(31, 3, 'Segundo', 2), item(30, 3, 'Primeiro', 1)] }),
        pool({ id: 1, nome: 'Primeira', killers: [item(11, 1, 'B', 2), item(10, 1, 'A', 1)] }),
        pool({ id: 2, nome: 'Inativa', ativa: false }),
        pool({ id: 4, guildId: 'guild-b', nome: 'Outra guild' }),
    ]);
    const service = (0, pool_service_1.createPoolService)(store);
    const listed = await service.list('guild-a');
    strict_1.default.deepEqual(listed.map(entry => entry.id), [1, 3]);
    strict_1.default.deepEqual(listed[0].killers.map(entry => entry.nome), ['A', 'B']);
    strict_1.default.deepEqual(listed[1].mapas.map(entry => entry.nome), ['Primeiro', 'Segundo']);
});
(0, node_test_1.default)('lists active and inactive guild pools for administration', async () => {
    const service = (0, pool_service_1.createPoolService)(new MemoryPoolStore([
        pool({ id: 2, guildId: 'guild-a', ativa: false }),
        pool({ id: 1, guildId: 'guild-a', ativa: true }),
        pool({ id: 3, guildId: 'guild-b', ativa: false }),
    ]));
    strict_1.default.deepEqual((await service.listAll('guild-a')).map(entry => [entry.id, entry.ativa]), [
        [1, true],
        [2, false],
    ]);
});
(0, node_test_1.default)('toggles and deletes a pool in its guild', async () => {
    const store = new MemoryPoolStore([pool()]);
    const service = (0, pool_service_1.createPoolService)(store);
    const toggled = await service.toggle('guild-a', 1);
    strict_1.default.equal(toggled.ok && toggled.value.ativa, false);
    strict_1.default.equal((await store.findPool(1))?.ativa, false);
    const deleted = await service.delete('guild-a', 1);
    strict_1.default.equal(deleted.ok && deleted.value.pool.nome, 'Pool 1');
    strict_1.default.equal(await store.findPool(1), null);
});
//# sourceMappingURL=pool-service.test.js.map