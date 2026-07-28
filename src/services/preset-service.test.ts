import assert from 'node:assert/strict';
import test from 'node:test';
import { PoolPreset } from '../data/pool-presets';
import { createPresetService, PresetStore } from './preset-service';

interface StoredPool {
  guildId: string;
  nome: string;
  formato: string;
  ativa: boolean;
  mapas: string[];
  killers: string[];
}

const PRESETS: PoolPreset[] = [
  {
    nome: 'Preset MD3',
    formato: 'MD3',
    mapas: ['Mapa 1', 'Mapa 2', 'Mapa 3'],
    killers: ['Killer 1', 'Killer 2'],
  },
  {
    nome: 'Preset MD5',
    formato: 'MD5',
    mapas: ['Mapa A', 'Mapa B'],
    killers: ['Killer A', 'Killer B'],
  },
];

class MemoryPresetStore implements PresetStore {
  private pools: StoredPool[];

  constructor(initialPools: StoredPool[] = []) {
    this.pools = structuredClone(initialPools);
  }

  async listPools(guildId: string): Promise<Array<{ nome: string }>> {
    return this.pools
      .filter(pool => pool.guildId === guildId)
      .map(pool => ({ nome: pool.nome }));
  }

  async createPresetPool(guildId: string, preset: PoolPreset): Promise<void> {
    this.pools = [
      ...this.pools,
      {
        guildId,
        nome: preset.nome,
        formato: preset.formato,
        ativa: true,
        mapas: [...preset.mapas],
        killers: [...preset.killers],
      },
    ];
  }

  snapshot(): StoredPool[] {
    return structuredClone(this.pools);
  }
}

test('creates missing preset pools and their initial items for a fresh guild', async () => {
  const store = new MemoryPresetStore();
  const service = createPresetService(store, PRESETS);

  const createdCount = await service.syncGuild('guild-a');

  assert.equal(createdCount, 2);
  assert.deepEqual(store.snapshot(), [
    {
      guildId: 'guild-a',
      nome: 'Preset MD3',
      formato: 'MD3',
      ativa: true,
      mapas: ['Mapa 1', 'Mapa 2', 'Mapa 3'],
      killers: ['Killer 1', 'Killer 2'],
    },
    {
      guildId: 'guild-a',
      nome: 'Preset MD5',
      formato: 'MD5',
      ativa: true,
      mapas: ['Mapa A', 'Mapa B'],
      killers: ['Killer A', 'Killer B'],
    },
  ]);
});

test('is idempotent when synchronized more than once', async () => {
  const store = new MemoryPresetStore();
  const service = createPresetService(store, PRESETS);

  await service.syncGuild('guild-a');
  const afterFirstRun = store.snapshot();
  const createdCount = await service.syncGuild('guild-a');

  assert.equal(createdCount, 0);
  assert.deepEqual(store.snapshot(), afterFirstRun);
});

test('preserves edited presets and custom pools while creating only missing presets', async () => {
  const editedPreset: StoredPool = {
    guildId: 'guild-a',
    nome: 'Preset MD3',
    formato: 'MD5',
    ativa: false,
    mapas: ['Mapa editado'],
    killers: ['Killer editado'],
  };
  const customPool: StoredPool = {
    guildId: 'guild-a',
    nome: 'Pool customizada',
    formato: 'MD3',
    ativa: false,
    mapas: ['Mapa customizado'],
    killers: ['Killer customizado'],
  };
  const otherGuildPool: StoredPool = {
    guildId: 'guild-b',
    nome: 'Preset MD5',
    formato: 'MD5',
    ativa: true,
    mapas: ['Outra guild'],
    killers: ['Outra guild'],
  };
  const store = new MemoryPresetStore([editedPreset, customPool, otherGuildPool]);
  const service = createPresetService(store, PRESETS);

  const createdCount = await service.syncGuild('guild-a');
  const pools = store.snapshot();

  assert.equal(createdCount, 1);
  assert.deepEqual(pools.slice(0, 3), [editedPreset, customPool, otherGuildPool]);
  assert.deepEqual(pools[3], {
    guildId: 'guild-a',
    nome: 'Preset MD5',
    formato: 'MD5',
    ativa: true,
    mapas: ['Mapa A', 'Mapa B'],
    killers: ['Killer A', 'Killer B'],
  });
});
