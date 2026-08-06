"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = __importDefault(require("node:test"));
const sandbox_1 = require("./sandbox");
const context = {
    user: { id: '123', username: 'staff' },
    guild: { id: '456', name: 'DTA' },
    channel: { id: '789' },
    locale: 'pt-BR',
    options: {},
    variables: {},
};
(0, node_test_1.default)('sandbox emits only validated Discord SDK actions', async () => {
    const result = await (0, sandbox_1.runSandboxScript)(`
    discord.reply({ content: { ptBR: 'Ola', enUS: 'Hello' }, ephemeral: true });
    discord.setVariable({ name: 'status', value: 'ok' });
    console.log(context.guild.name);
  `, context);
    strict_1.default.equal(result.workflow[0]?.type, 'reply');
    strict_1.default.equal(result.workflow[1]?.type, 'set_variable');
    strict_1.default.deepEqual(result.logs, ['DTA']);
});
(0, node_test_1.default)('sandbox blocks Node globals', async () => {
    const result = await (0, sandbox_1.runSandboxScript)(`
    discord.reply(String(typeof process) + ':' + String(typeof require) + ':' + String(typeof fetch));
  `, context);
    const step = result.workflow[0];
    strict_1.default.equal(step?.type, 'reply');
    if (step?.type === 'reply')
        strict_1.default.equal(step.message.content?.ptBR, 'undefined:undefined:undefined');
});
(0, node_test_1.default)('sandbox interrupts infinite loops', async () => {
    await strict_1.default.rejects((0, sandbox_1.runSandboxScript)('while (true) {}', context), /interrupted|sandbox/i);
});
//# sourceMappingURL=sandbox.test.js.map