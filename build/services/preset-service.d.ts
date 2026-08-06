import { PoolPreset } from '../data/pool-presets';
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
export declare function createPresetService(store: PresetStore, presets?: readonly PoolPreset[]): PresetService;
//# sourceMappingURL=preset-service.d.ts.map