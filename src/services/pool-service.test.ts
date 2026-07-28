import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createPoolService,
  PoolItem,
  PoolRecord,
  PoolStore,
  PoolWithItems,
} from './pool-service';

function item(id: number, poolId: number, nome: string, ordem: number): PoolItem {
  return { id, poolId, nome, ordem };
}

function pool(overrides: Partial<PoolWithItems> = {}): PoolWithItems {
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

class MemoryPoolStore implements PoolStore {
  private pools: PoolWithItems[];
  private nextPoolId: number;
  private nextItemId: number;

  constructor(initialPools: PoolWithItems[] = []) {
    this.pools = structuredClone(initialPools);
    this.nextPoolId = Math.max(0, ...initialPools.map(entry => entry.id)) + 1;
    this.nextItemId = Math.max(
      0,
      ...initialPools.flatMap(entry => [...entry.mapas, ...entry.killers]).map(entry => entry.id),
    ) + 1;
  }

  async createPool(input: { guildId: string; nome: string; formato: string }): Promise<PoolRecord> {
    const created = pool({ id: this.nextPoolId++, ...input });
    this.pools = [...this.pools, created];
    return structuredClone(created);
  }

  async findPool(poolId: number): Promise<PoolWithItems | null> {
    const found = this.pools.find(entry => entry.id === poolId);
    return found ? structuredClone(found) : null;
  }

  async listActivePools(guildId: string): Promise<PoolWithItems[]> {
    return structuredClone(this.pools
      .filter(entry => entry.guildId === guildId && entry.ativa)
      .sort((left, right) => left.id - right.id)
      .map(entry => ({
        ...entry,
        mapas: [...entry.mapas].sort((left, right) => left.ordem - right.ordem),
        killers: [...entry.killers].sort((left, right) => left.ordem - right.ordem),
      })));
  }

  async createMap(input: { poolId: number; nome: string; ordem: number }): Promise<PoolItem> {
    const created = item(this.nextItemId++, input.poolId, input.nome, input.ordem);
    this.updateItems(input.poolId, 'mapas', entries => [...entries, created]);
    return structuredClone(created);
  }

  async deleteMap(itemId: number): Promise<void> {
    this.pools = this.pools.map(entry => ({
      ...entry,
      mapas: entry.mapas.filter(candidate => candidate.id !== itemId),
    }));
  }

  async createKiller(input: { poolId: number; nome: string; ordem: number }): Promise<PoolItem> {
    const created = item(this.nextItemId++, input.poolId, input.nome, input.ordem);
    this.updateItems(input.poolId, 'killers', entries => [...entries, created]);
    return structuredClone(created);
  }

  async deleteKiller(itemId: number): Promise<void> {
    this.pools = this.pools.map(entry => ({
      ...entry,
      killers: entry.killers.filter(candidate => candidate.id !== itemId),
    }));
  }

  async deletePool(poolId: number): Promise<void> {
    this.pools = this.pools.filter(entry => entry.id !== poolId);
  }

  async setPoolActive(poolId: number, ativa: boolean): Promise<void> {
    this.pools = this.pools.map(entry => entry.id === poolId ? { ...entry, ativa } : entry);
  }

  private updateItems(
    poolId: number,
    key: 'mapas' | 'killers',
    update: (items: PoolItem[]) => PoolItem[],
  ): void {
    this.pools = this.pools.map(entry => entry.id === poolId
      ? { ...entry, [key]: update(entry[key]) }
      : entry);
  }
}

test('creates a pool scoped to the supplied guild', async () => {
  const store = new MemoryPoolStore();
  const service = createPoolService(store);

  const created = await service.create('guild-b', 'Pool nova', 'MD5');

  assert.equal(created.guildId, 'guild-b');
  assert.equal(created.nome, 'Pool nova');
  assert.equal(created.formato, 'MD5');
});

test('blocks pool operations from another guild', async () => {
  const store = new MemoryPoolStore([pool()]);
  const service = createPoolService(store);

  assert.deepEqual(await service.addMap('guild-b', 1, 'Ormond'), { ok: false, reason: 'POOL_NOT_FOUND' });
  assert.deepEqual(await service.addKiller('guild-b', 1, 'Spirit'), { ok: false, reason: 'POOL_NOT_FOUND' });
  assert.deepEqual(await service.toggle('guild-b', 1), { ok: false, reason: 'POOL_NOT_FOUND' });
  assert.deepEqual(await service.delete('guild-b', 1), { ok: false, reason: 'POOL_NOT_FOUND' });
  assert.equal((await store.findPool(1))?.ativa, true);
});

test('rejects duplicate maps and killers case-insensitively', async () => {
  const store = new MemoryPoolStore([pool({
    mapas: [item(10, 1, 'Wretched Shop', 1)],
    killers: [item(11, 1, 'The First', 1)],
  })]);
  const service = createPoolService(store);

  assert.deepEqual(await service.addMap('guild-a', 1, 'wReTcHeD sHoP'), {
    ok: false,
    reason: 'MAP_ALREADY_EXISTS',
  });
  assert.deepEqual(await service.addKiller('guild-a', 1, 'the first'), {
    ok: false,
    reason: 'KILLER_ALREADY_EXISTS',
  });
});

test('reports missing pools, maps and killers', async () => {
  const service = createPoolService(new MemoryPoolStore([pool()]));

  assert.deepEqual(await service.removeMap('guild-a', 99, 'Ormond'), { ok: false, reason: 'POOL_NOT_FOUND' });
  assert.deepEqual(await service.removeKiller('guild-a', 99, 'Spirit'), { ok: false, reason: 'POOL_NOT_FOUND' });
  assert.deepEqual(await service.removeMap('guild-a', 1, 'Ormond'), { ok: false, reason: 'MAP_NOT_FOUND' });
  assert.deepEqual(await service.removeKiller('guild-a', 1, 'Spirit'), { ok: false, reason: 'KILLER_NOT_FOUND' });
});

test('assigns map and killer order from the current item count', async () => {
  const store = new MemoryPoolStore([pool({
    mapas: [item(10, 1, 'Mapa 1', 4), item(11, 1, 'Mapa 2', 1)],
    killers: [item(12, 1, 'Killer 1', 7)],
  })]);
  const service = createPoolService(store);

  const mapResult = await service.addMap('guild-a', 1, 'Mapa 3');
  const killerResult = await service.addKiller('guild-a', 1, 'Killer 2');

  assert.equal(mapResult.ok && mapResult.value.ordem, 3);
  assert.equal(killerResult.ok && killerResult.value.ordem, 2);
  assert.deepEqual((await store.findPool(1))?.mapas.map(entry => entry.ordem), [4, 1, 3]);
  assert.deepEqual((await store.findPool(1))?.killers.map(entry => entry.ordem), [7, 2]);
});

test('removes matching maps and killers case-insensitively', async () => {
  const store = new MemoryPoolStore([pool({
    mapas: [item(10, 1, 'Ormond', 1)],
    killers: [item(11, 1, 'Spirit', 1)],
  })]);
  const service = createPoolService(store);

  assert.equal((await service.removeMap('guild-a', 1, 'ORMOND')).ok, true);
  assert.equal((await service.removeKiller('guild-a', 1, 'spirit')).ok, true);
  assert.deepEqual((await store.findPool(1))?.mapas, []);
  assert.deepEqual((await store.findPool(1))?.killers, []);
});

test('lists only active guild pools ordered by pool and item order', async () => {
  const store = new MemoryPoolStore([
    pool({ id: 3, nome: 'Terceira', mapas: [item(31, 3, 'Segundo', 2), item(30, 3, 'Primeiro', 1)] }),
    pool({ id: 1, nome: 'Primeira', killers: [item(11, 1, 'B', 2), item(10, 1, 'A', 1)] }),
    pool({ id: 2, nome: 'Inativa', ativa: false }),
    pool({ id: 4, guildId: 'guild-b', nome: 'Outra guild' }),
  ]);
  const service = createPoolService(store);

  const listed = await service.list('guild-a');

  assert.deepEqual(listed.map(entry => entry.id), [1, 3]);
  assert.deepEqual(listed[0].killers.map(entry => entry.nome), ['A', 'B']);
  assert.deepEqual(listed[1].mapas.map(entry => entry.nome), ['Primeiro', 'Segundo']);
});

test('toggles and deletes a pool in its guild', async () => {
  const store = new MemoryPoolStore([pool()]);
  const service = createPoolService(store);

  const toggled = await service.toggle('guild-a', 1);
  assert.equal(toggled.ok && toggled.value.ativa, false);
  assert.equal((await store.findPool(1))?.ativa, false);

  const deleted = await service.delete('guild-a', 1);
  assert.equal(deleted.ok && deleted.value.pool.nome, 'Pool 1');
  assert.equal(await store.findPool(1), null);
});
