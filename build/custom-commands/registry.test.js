"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = __importDefault(require("node:test"));
const definition_1 = require("./definition");
const registry_1 = require("./registry");
function registration(input, isPublished = true) {
    const definition = (0, definition_1.createBlankCommandDefinition)(input.name ?? 'custom');
    return {
        command: {
            guildId: 'guild', stableKey: `custom:${input.id}`, factoryCommandName: null,
            name: definition.command.name.ptBR, description: definition.command.description.ptBR,
            draftDefinition: JSON.stringify(definition), status: 'published',
            publishedVersionId: isPublished ? input.id : null, discordCommandId: null,
            createdByUserId: 'user', updatedByUserId: 'user', criadoEm: new Date(), atualizadoEm: new Date(),
            ...input,
        },
        version: null,
        definition: isPublished ? definition : null,
    };
}
(0, node_test_1.default)('keeps factory commands for drafts and suppresses disabled native overrides', () => {
    const native = [{ name: 'ranking', description: 'Ranking' }, { name: 'perfil', description: 'Perfil' }];
    const draft = registration({ id: 1, sourceType: 'native', factoryCommandName: 'ranking', name: 'ranking', enabled: true }, false);
    const disabled = registration({ id: 2, sourceType: 'native', factoryCommandName: 'perfil', name: 'perfil', enabled: false });
    const result = (0, registry_1.composeGuildCommandPayloads)('guild', native, [draft, disabled]);
    strict_1.default.deepEqual(result.payloads, [native[0]]);
    strict_1.default.equal(result.dynamicByName.size, 0);
});
(0, node_test_1.default)('registers published custom commands and maps their Discord names', () => {
    const custom = registration({ id: 7, sourceType: 'custom', name: 'custom', enabled: true });
    const result = (0, registry_1.composeGuildCommandPayloads)('guild', [], [custom]);
    strict_1.default.equal(result.payloads.length, 1);
    strict_1.default.equal(result.payloads[0].name, 'custom');
    strict_1.default.equal(result.dynamicByName.get('custom'), 7);
});
//# sourceMappingURL=registry.test.js.map