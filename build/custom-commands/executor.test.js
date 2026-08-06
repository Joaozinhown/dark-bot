"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = __importDefault(require("node:test"));
const definition_1 = require("./definition");
const executor_1 = require("./executor");
function mockInteraction() {
    const replies = [];
    const interaction = {
        locale: 'pt-BR',
        user: { id: '123456789012345678', username: 'tester' },
        guildId: '223456789012345678',
        guild: { id: '223456789012345678', name: 'Guild' },
        channelId: '323456789012345678',
        replied: false,
        deferred: false,
        options: { data: [] },
        async reply(payload) {
            replies.push(payload);
            interaction.replied = true;
        },
        async followUp() {
            throw new Error('followUp cannot be the initial acknowledgement');
        },
    };
    return { interaction: interaction, replies };
}
(0, node_test_1.default)('acknowledges workflows that only change internal state', async () => {
    const definition = (0, definition_1.createBlankCommandDefinition)('state');
    definition.workflow = [{ id: 'state_1', type: 'set_variable', name: 'result', value: 'ok' }];
    const { interaction, replies } = mockInteraction();
    await (0, executor_1.executeDynamicCommand)(interaction, { commandId: 1, versionId: 1, definition });
    strict_1.default.equal(replies.length, 1);
    strict_1.default.match(String(replies[0].content), /Comando executado/);
});
(0, node_test_1.default)('uses the initial reply slot when a workflow starts with followup', async () => {
    const definition = (0, definition_1.createBlankCommandDefinition)('followup');
    const initial = definition.workflow[0];
    strict_1.default.ok(initial && initial.type === 'reply');
    definition.workflow = [{ id: initial.id, type: 'followup', message: initial.message }];
    const { interaction, replies } = mockInteraction();
    await (0, executor_1.executeDynamicCommand)(interaction, { commandId: 1, versionId: 1, definition });
    strict_1.default.equal(replies.length, 1);
    strict_1.default.equal(replies[0].content, 'Resposta do comando');
});
//# sourceMappingURL=executor.test.js.map