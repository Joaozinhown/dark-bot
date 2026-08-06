"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = __importDefault(require("node:test"));
const discord_js_1 = require("discord.js");
const role_service_1 = require("./role-service");
(0, node_test_1.default)('rejects an invalid hexadecimal role color', () => {
    strict_1.default.equal((0, role_service_1.parseTeamRoleColor)('#GG0000'), null);
    strict_1.default.equal((0, role_service_1.parseTeamRoleColor)('#12345'), null);
    strict_1.default.equal((0, role_service_1.parseTeamRoleColor)('#1234567'), null);
});
(0, node_test_1.default)('parses a valid role color and defaults when omitted', () => {
    strict_1.default.equal((0, role_service_1.parseTeamRoleColor)('#FF0000'), 0xff0000);
    strict_1.default.equal((0, role_service_1.parseTeamRoleColor)('00ff7f'), 0x00ff7f);
    strict_1.default.equal((0, role_service_1.parseTeamRoleColor)(null), discord_js_1.Colors.Default);
});
(0, node_test_1.default)('creates a role with the discord.js colors payload', async () => {
    let received;
    const role = await (0, role_service_1.createTeamRole)({
        async create(options) {
            received = options;
            return { id: 'role-1', name: options.name };
        },
    }, {
        name: 'Time A',
        color: 0x8f32d9,
        createdBy: 'Organizador',
    });
    strict_1.default.deepEqual(received, {
        name: 'Time A',
        colors: { primaryColor: 0x8f32d9 },
        reason: 'Cargo de time criado por Organizador',
    });
    strict_1.default.deepEqual(role, { id: 'role-1', name: 'Time A' });
});
(0, node_test_1.default)('renames and deletes a role with the current audit reason', async () => {
    const calls = [];
    const role = {
        name: 'Time A',
        async setName(name) {
            calls.push(['rename', name]);
        },
        async delete(reason) {
            calls.push(['delete', reason]);
        },
    };
    await (0, role_service_1.renameTeamRole)(role, 'Time B');
    await (0, role_service_1.deleteTeamRole)(role);
    strict_1.default.deepEqual(calls, [
        ['rename', 'Time B'],
        ['delete', 'Deletado por organizador'],
    ]);
});
(0, node_test_1.default)('adds and removes a member role by id', async () => {
    const calls = [];
    const memberRoles = {
        async add(roleId) {
            calls.push(['add', roleId]);
        },
        async remove(roleId) {
            calls.push(['remove', roleId]);
        },
    };
    await (0, role_service_1.addMemberToTeamRole)(memberRoles, 'role-1');
    await (0, role_service_1.removeMemberFromTeamRole)(memberRoles, 'role-1');
    strict_1.default.deepEqual(calls, [
        ['add', 'role-1'],
        ['remove', 'role-1'],
    ]);
});
//# sourceMappingURL=role-service.test.js.map