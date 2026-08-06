"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = __importDefault(require("node:test"));
const startup_1 = require("./startup");
const disabledConfig = { enabled: false };
const enabledConfig = {
    enabled: true,
    clientId: '123456789012345678',
    clientSecret: 'secret',
    redirectUri: 'https://panel.example.com/api/auth/callback',
    cookieSecret: 'c'.repeat(32),
    encryptionKey: Buffer.alloc(32, 1),
    port: 8080,
    isProduction: true,
};
(0, node_test_1.default)('starts the bot without attempting the panel when it is disabled', async () => {
    const calls = [];
    await (0, startup_1.runPanelBeforeBot)({
        config: disabledConfig,
        startPanel: async () => { calls.push('panel'); },
        startBot: async () => { calls.push('bot'); },
        reportPanelError: () => { calls.push('error'); },
    });
    strict_1.default.deepEqual(calls, ['bot']);
});
(0, node_test_1.default)('continues bot startup after the panel listener fails', async () => {
    const calls = [];
    await (0, startup_1.runPanelBeforeBot)({
        config: enabledConfig,
        startPanel: async () => {
            calls.push('panel');
            throw new Error('address already in use');
        },
        startBot: async () => { calls.push('bot'); },
        reportPanelError: error => {
            strict_1.default.match(error instanceof Error ? error.message : String(error), /address already in use/);
            calls.push('error');
        },
    });
    strict_1.default.deepEqual(calls, ['panel', 'error', 'bot']);
});
(0, node_test_1.default)('starts the panel before continuing bot startup when enabled', async () => {
    const calls = [];
    await (0, startup_1.runPanelBeforeBot)({
        config: enabledConfig,
        startPanel: async () => { calls.push('panel'); },
        startBot: async () => { calls.push('bot'); },
        reportPanelError: () => { calls.push('error'); },
    });
    strict_1.default.deepEqual(calls, ['panel', 'bot']);
});
(0, node_test_1.default)('turns invalid panel configuration into a disabled panel', () => {
    const errors = [];
    const config = (0, startup_1.readPanelConfigSafely)({
        readConfig: () => { throw new Error('missing client secret'); },
        reportConfigError: error => errors.push(error),
    });
    strict_1.default.deepEqual(config, { enabled: false });
    strict_1.default.equal(errors.length, 1);
    strict_1.default.match(errors[0] instanceof Error ? errors[0].message : String(errors[0]), /client secret/);
});
//# sourceMappingURL=startup.test.js.map