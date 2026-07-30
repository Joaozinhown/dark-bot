import { POOL_PRESETS, PoolPreset } from '../data/pool-presets';

export interface ExistingPresetPool {
  nome: string;
}

export interface PresetStore {
  listPools(guildId: string): Promise<ExistingPresetPool[]>;
  createPresetPool(guildId: string, preset: PoolPreset): Promise<void>;
}

export interface PresetService {
  syncGuild(guildId: string): Promise<number>;
}

export function createPresetService(
  store: PresetStore,
  presets: readonly PoolPreset[] = POOL_PRESETS,
): PresetService {
  return {
    async syncGuild(guildId: string): Promise<number> {
      const existingPools = await store.listPools(guildId);
      const existingNames = new Set(existingPools.map(pool => pool.nome));
      let createdCount = 0;

      for (const preset of presets) {
        if (existingNames.has(preset.nome)) continue;

        await store.createPresetPool(guildId, preset);
        existingNames.add(preset.nome);
        createdCount += 1;
      }

      return createdCount;
    },
  };
}
