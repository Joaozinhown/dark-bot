"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPresetService = createPresetService;
const pool_presets_1 = require("../data/pool-presets");
function createPresetService(store, presets = pool_presets_1.POOL_PRESETS) {
    return {
        async syncGuild(guildId) {
            const existingPools = await store.listPools(guildId);
            const existingNames = new Set(existingPools.map(pool => pool.nome));
            let createdCount = 0;
            for (const preset of presets) {
                if (existingNames.has(preset.nome))
                    continue;
                await store.createPresetPool(guildId, preset);
                existingNames.add(preset.nome);
                createdCount += 1;
            }
            return createdCount;
        },
    };
}
//# sourceMappingURL=preset-service.js.map