"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = __importDefault(require("node:test"));
const runtime_1 = require("./runtime");
(0, node_test_1.default)('forces a fresh Discord member fetch before granting guild access', async () => {
    const fetchCalls = [];
    const guild = {
        id: 'guild-a',
        ownerId: 'user-1',
        members: {
            async fetch(options) {
                fetchCalls.push(options);
                return {
                    permissions: { has: () => false },
                    roles: { cache: new Map([['role-a', {}]]) },
                };
            },
        },
    };
    strict_1.default.equal(await (0, runtime_1.hasLiveGuildAccess)(guild, 'user-1'), true);
    strict_1.default.deepEqual(fetchCalls, [{ user: 'user-1', force: true }]);
});
(0, node_test_1.default)('denies guild access when the fresh member fetch fails', async () => {
    const guild = {
        id: 'guild-a',
        ownerId: 'user-1',
        members: {
            async fetch() {
                throw new Error('Unknown Member');
            },
        },
    };
    strict_1.default.equal(await (0, runtime_1.hasLiveGuildAccess)(guild, 'user-1'), false);
});
//# sourceMappingURL=runtime.test.js.map