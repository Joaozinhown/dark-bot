"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = __importDefault(require("node:test"));
const preset_service_1 = require("./preset-service");
const PRESETS = [
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
class MemoryPresetStore {
    pools;
    constructor(initialPools = []) {
        this.pools = structuredClone(initialPools);
    }
    async listPools(guildId) {
        return this.pools
            .filter(pool => pool.guildId === guildId)
            .map(pool => ({ nome: pool.nome }));
    }
    async createPresetPool(guildId, preset) {
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
    snapshot() {
        return structuredClone(this.pools);
    }
}
(0, node_test_1.default)('creates missing preset pools and their initial items for a fresh guild', async () => {
    const store = new MemoryPresetStore();
    const service = (0, preset_service_1.createPresetService)(store, PRESETS);
    const createdCount = await service.syncGuild('guild-a');
    strict_1.default.equal(createdCount, 2);
    strict_1.default.deepEqual(store.snapshot(), [
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
(0, node_test_1.default)('is idempotent when synchronized more than once', async () => {
    const store = new MemoryPresetStore();
    const service = (0, preset_service_1.createPresetService)(store, PRESETS);
    await service.syncGuild('guild-a');
    const afterFirstRun = store.snapshot();
    const createdCount = await service.syncGuild('guild-a');
    strict_1.default.equal(createdCount, 0);
    strict_1.default.deepEqual(store.snapshot(), afterFirstRun);
});
(0, node_test_1.default)('preserves edited presets and custom pools while creating only missing presets', async () => {
    const editedPreset = {
        guildId: 'guild-a',
        nome: 'Preset MD3',
        formato: 'MD5',
        ativa: false,
        mapas: ['Mapa editado'],
        killers: ['Killer editado'],
    };
    const customPool = {
        guildId: 'guild-a',
        nome: 'Pool customizada',
        formato: 'MD3',
        ativa: false,
        mapas: ['Mapa customizado'],
        killers: ['Killer customizado'],
    };
    const otherGuildPool = {
        guildId: 'guild-b',
        nome: 'Preset MD5',
        formato: 'MD5',
        ativa: true,
        mapas: ['Outra guild'],
        killers: ['Outra guild'],
    };
    const store = new MemoryPresetStore([editedPreset, customPool, otherGuildPool]);
    const service = (0, preset_service_1.createPresetService)(store, PRESETS);
    const createdCount = await service.syncGuild('guild-a');
    const pools = store.snapshot();
    strict_1.default.equal(createdCount, 1);
    strict_1.default.deepEqual(pools.slice(0, 3), [editedPreset, customPool, otherGuildPool]);
    strict_1.default.deepEqual(pools[3], {
        guildId: 'guild-a',
        nome: 'Preset MD5',
        formato: 'MD5',
        ativa: true,
        mapas: ['Mapa A', 'Mapa B'],
        killers: ['Killer A', 'Killer B'],
    });
});
//# sourceMappingURL=preset-service.test.js.map