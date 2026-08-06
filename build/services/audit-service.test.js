"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = __importDefault(require("node:test"));
const audit_service_1 = require("./audit-service");
function record(overrides = {}) {
    return {
        id: 1,
        guildId: 'guild-a',
        actorUserId: 'user-a',
        action: 'pool.updated',
        entityType: 'pool',
        entityId: '4',
        details: '{"name":"Pool 4"}',
        criadoEm: new Date('2026-07-28T12:00:00.000Z'),
        ...overrides,
    };
}
(0, node_test_1.default)('serializes structured audit details on write', async () => {
    let input;
    const store = {
        create: async (value) => {
            input = value;
            return record(value);
        },
        listByGuild: async () => [],
    };
    const service = (0, audit_service_1.createAuditService)(store);
    await service.write({
        guildId: 'guild-a',
        actorUserId: 'user-a',
        action: 'pool.updated',
        entityType: 'pool',
        entityId: '4',
        details: { name: 'Pool 4' },
    });
    strict_1.default.deepEqual(input, {
        guildId: 'guild-a',
        actorUserId: 'user-a',
        action: 'pool.updated',
        entityType: 'pool',
        entityId: '4',
        details: '{"name":"Pool 4"}',
    });
});
(0, node_test_1.default)('lists only the requested guild and caps the page size', async () => {
    const calls = [];
    const store = {
        create: async (value) => record(value),
        listByGuild: async (guildId, limit) => {
            calls.push([guildId, limit]);
            return [record({ guildId })];
        },
    };
    const service = (0, audit_service_1.createAuditService)(store);
    const entries = await service.list('guild-b', 500);
    strict_1.default.deepEqual(calls, [['guild-b', 100]]);
    strict_1.default.equal(entries[0].guildId, 'guild-b');
    strict_1.default.deepEqual(entries[0].details, { name: 'Pool 4' });
});
(0, node_test_1.default)('returns an empty detail object for malformed legacy JSON', async () => {
    const store = {
        create: async (value) => record(value),
        listByGuild: async () => [record({ details: '{broken' })],
    };
    const entries = await (0, audit_service_1.createAuditService)(store).list('guild-a');
    strict_1.default.deepEqual(entries[0].details, {});
});
//# sourceMappingURL=audit-service.test.js.map