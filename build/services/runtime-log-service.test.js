"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = __importDefault(require("node:test"));
const runtime_log_service_1 = require("./runtime-log-service");
(0, node_test_1.default)('returns a bounded runtime snapshot when Discloud token is absent', async () => {
    const previousToken = process.env.DISCLOUD_TOKEN;
    delete process.env.DISCLOUD_TOKEN;
    try {
        const snapshot = await runtime_log_service_1.runtimeLogService.getSnapshot();
        strict_1.default.equal(snapshot.source, 'runtime');
        strict_1.default.equal(snapshot.isExactDiscloudSnapshot, false);
        strict_1.default.equal(typeof snapshot.content, 'string');
        strict_1.default.ok(snapshot.content.length <= 300_000);
    }
    finally {
        if (previousToken)
            process.env.DISCLOUD_TOKEN = previousToken;
    }
});
(0, node_test_1.default)('returns the exact terminal snapshot from the official Discloud endpoint', async () => {
    const previousToken = process.env.DISCLOUD_TOKEN;
    const previousAppId = process.env.DISCLOUD_APP_ID;
    const originalFetch = globalThis.fetch;
    process.env.DISCLOUD_TOKEN = 'private-test-token';
    process.env.DISCLOUD_APP_ID = 'admin-dta-bot';
    globalThis.fetch = async (input, init) => {
        strict_1.default.equal(String(input), 'https://api.discloud.app/v2/app/admin-dta-bot/logs');
        strict_1.default.equal((init?.headers)['api-token'], 'private-test-token');
        return new Response(JSON.stringify({ apps: { terminal: { big: 'linha exata da Discloud' } } }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
        });
    };
    try {
        const snapshot = await runtime_log_service_1.runtimeLogService.getSnapshot();
        strict_1.default.equal(snapshot.source, 'discloud');
        strict_1.default.equal(snapshot.isExactDiscloudSnapshot, true);
        strict_1.default.equal(snapshot.content, 'linha exata da Discloud');
    }
    finally {
        globalThis.fetch = originalFetch;
        if (previousToken === undefined)
            delete process.env.DISCLOUD_TOKEN;
        else
            process.env.DISCLOUD_TOKEN = previousToken;
        if (previousAppId === undefined)
            delete process.env.DISCLOUD_APP_ID;
        else
            process.env.DISCLOUD_APP_ID = previousAppId;
    }
});
//# sourceMappingURL=runtime-log-service.test.js.map