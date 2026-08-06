"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = __importDefault(require("node:test"));
const guild_permission_service_1 = require("./guild-permission-service");
function createStore(initialValues = {}) {
    const values = new Map(Object.entries(initialValues));
    const reads = [];
    return {
        values,
        reads,
        store: {
            async getAdminRoleIds(guildId) {
                reads.push(guildId);
                return values.get(guildId) ?? null;
            },
            async setAdminRoleIds(guildId, adminRoleIds) {
                values.set(guildId, adminRoleIds);
            },
        },
    };
}
(0, node_test_1.default)('returns no roles when stored JSON is invalid or not an array', async () => {
    const { store } = createStore({
        invalid: '{broken',
        object: '{"role":"role-1"}',
    });
    const service = (0, guild_permission_service_1.createGuildPermissionService)(store);
    strict_1.default.deepEqual(await service.listAdminRoleIds('invalid'), []);
    strict_1.default.deepEqual(await service.listAdminRoleIds('object'), []);
    strict_1.default.deepEqual(await service.listAdminRoleIds('missing'), []);
});
(0, node_test_1.default)('filters invalid values and deduplicates stored role IDs', async () => {
    const { store } = createStore({
        guildA: JSON.stringify(['role-1', 42, '', 'role-1', 'role-2', null]),
    });
    const service = (0, guild_permission_service_1.createGuildPermissionService)(store);
    strict_1.default.deepEqual(await service.listAdminRoleIds('guildA'), [
        'role-1',
        'role-2',
    ]);
});
(0, node_test_1.default)('adds and removes roles without duplicates', async () => {
    const { store, values } = createStore({
        guildA: JSON.stringify(['role-1']),
    });
    const service = (0, guild_permission_service_1.createGuildPermissionService)(store);
    strict_1.default.deepEqual(await service.addAdminRole('guildA', 'role-1'), ['role-1']);
    strict_1.default.deepEqual(await service.addAdminRole('guildA', 'role-2'), [
        'role-1',
        'role-2',
    ]);
    strict_1.default.deepEqual(await service.removeAdminRole('guildA', 'role-1'), [
        'role-2',
    ]);
    strict_1.default.equal(values.get('guildA'), JSON.stringify(['role-2']));
});
(0, node_test_1.default)('keeps role configuration isolated by guild', async () => {
    const { store } = createStore({
        guildA: JSON.stringify(['role-a']),
        guildB: JSON.stringify(['role-b']),
    });
    const service = (0, guild_permission_service_1.createGuildPermissionService)(store);
    await service.addAdminRole('guildA', 'role-a2');
    strict_1.default.deepEqual(await service.listAdminRoleIds('guildA'), [
        'role-a',
        'role-a2',
    ]);
    strict_1.default.deepEqual(await service.listAdminRoleIds('guildB'), ['role-b']);
});
(0, node_test_1.default)('grants Manage Guild permission without reading stored roles', async () => {
    const { store, reads } = createStore();
    const service = (0, guild_permission_service_1.createGuildPermissionService)(store);
    const allowed = await service.hasBotAdminPermission({
        guildId: 'guildA',
        hasManageGuild: true,
        roleIds: [],
    });
    strict_1.default.equal(allowed, true);
    strict_1.default.deepEqual(reads, []);
});
(0, node_test_1.default)('evaluates configured roles only within the subject guild', async () => {
    const { store } = createStore({
        guildA: JSON.stringify(['role-a']),
        guildB: JSON.stringify(['role-b']),
    });
    const service = (0, guild_permission_service_1.createGuildPermissionService)(store);
    strict_1.default.equal(await service.hasBotAdminPermission({
        guildId: 'guildA',
        hasManageGuild: false,
        roleIds: ['role-a'],
    }), true);
    strict_1.default.equal(await service.hasBotAdminPermission({
        guildId: 'guildA',
        hasManageGuild: false,
        roleIds: ['role-b'],
    }), false);
});
//# sourceMappingURL=guild-permission-service.test.js.map