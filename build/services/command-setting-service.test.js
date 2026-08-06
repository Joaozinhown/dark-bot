"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = __importDefault(require("node:test"));
const command_setting_service_1 = require("./command-setting-service");
const ALLOWED_COMMANDS = ['ranking', 'perfil', 'relatorios'];
function createStore(initial = []) {
    let records = initial.map(record => ({ ...record }));
    const reads = [];
    const writes = [];
    return {
        reads,
        writes,
        snapshot: () => records.map(record => ({ ...record })),
        store: {
            async find(guildId, commandName) {
                reads.push([guildId, commandName]);
                return records.find(record => record.guildId === guildId && record.commandName === commandName) ?? null;
            },
            async listByGuild(guildId) {
                return records
                    .filter(record => record.guildId === guildId)
                    .map(record => ({ ...record }));
            },
            async upsert(input) {
                const record = { ...input };
                writes.push(record);
                records = [
                    ...records.filter(current => !(current.guildId === input.guildId
                        && current.commandName === input.commandName)),
                    record,
                ];
                return { ...record };
            },
        },
    };
}
(0, node_test_1.default)('treats an existing slash command as enabled when the guild has no setting', async () => {
    const { store, reads } = createStore();
    const service = (0, command_setting_service_1.createCommandSettingService)(store, ALLOWED_COMMANDS);
    strict_1.default.equal(await service.isEnabled('guild-a', 'ranking'), true);
    strict_1.default.deepEqual(reads, [['guild-a', 'ranking']]);
});
(0, node_test_1.default)('returns the persisted state for the requested guild and command', async () => {
    const { store } = createStore([
        {
            guildId: 'guild-a',
            commandName: 'ranking',
            enabled: false,
            updatedByUserId: 'user-1',
        },
    ]);
    const service = (0, command_setting_service_1.createCommandSettingService)(store, ALLOWED_COMMANDS);
    strict_1.default.equal(await service.isEnabled('guild-a', 'ranking'), false);
});
(0, node_test_1.default)('does not leak a command setting between guilds', async () => {
    const { store } = createStore([
        {
            guildId: 'guild-a',
            commandName: 'ranking',
            enabled: false,
            updatedByUserId: 'user-1',
        },
    ]);
    const service = (0, command_setting_service_1.createCommandSettingService)(store, ALLOWED_COMMANDS);
    strict_1.default.equal(await service.isEnabled('guild-a', 'ranking'), false);
    strict_1.default.equal(await service.isEnabled('guild-b', 'ranking'), true);
});
(0, node_test_1.default)('lists only allowlisted commands and fills missing settings as enabled', async () => {
    const { store } = createStore([
        {
            guildId: 'guild-a',
            commandName: 'perfil',
            enabled: false,
            updatedByUserId: 'user-1',
        },
        {
            guildId: 'guild-a',
            commandName: 'removed-command',
            enabled: false,
            updatedByUserId: 'user-1',
        },
        {
            guildId: 'guild-b',
            commandName: 'ranking',
            enabled: false,
            updatedByUserId: 'user-2',
        },
    ]);
    const service = (0, command_setting_service_1.createCommandSettingService)(store, ALLOWED_COMMANDS);
    strict_1.default.deepEqual(await service.list('guild-a'), [
        { commandName: 'ranking', enabled: true },
        { commandName: 'perfil', enabled: false },
        { commandName: 'relatorios', enabled: true },
    ]);
});
(0, node_test_1.default)('rejects a command outside the injected allowlist before reading or writing', async () => {
    const { store, reads, writes } = createStore();
    const service = (0, command_setting_service_1.createCommandSettingService)(store, ALLOWED_COMMANDS);
    await strict_1.default.rejects(service.isEnabled('guild-a', 'novo-comando'), (error) => error instanceof command_setting_service_1.CommandSettingServiceError
        && error.code === 'COMMAND_NOT_ALLOWED');
    await strict_1.default.rejects(service.setEnabled({
        guildId: 'guild-a',
        commandName: 'novo-comando',
        enabled: false,
        updatedByUserId: 'user-1',
    }), (error) => error instanceof command_setting_service_1.CommandSettingServiceError
        && error.code === 'COMMAND_NOT_ALLOWED');
    strict_1.default.deepEqual(reads, []);
    strict_1.default.deepEqual(writes, []);
});
(0, node_test_1.default)('persists command state with guild and actor identity', async () => {
    const { store, snapshot, writes } = createStore();
    const service = (0, command_setting_service_1.createCommandSettingService)(store, ALLOWED_COMMANDS);
    const result = await service.setEnabled({
        guildId: 'guild-a',
        commandName: 'relatorios',
        enabled: false,
        updatedByUserId: 'user-7',
    });
    strict_1.default.deepEqual(result, {
        guildId: 'guild-a',
        commandName: 'relatorios',
        enabled: false,
        updatedByUserId: 'user-7',
    });
    strict_1.default.deepEqual(writes, [result]);
    strict_1.default.deepEqual(snapshot(), [result]);
    strict_1.default.equal(await service.isEnabled('guild-b', 'relatorios'), true);
});
//# sourceMappingURL=command-setting-service.test.js.map