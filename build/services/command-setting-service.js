"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prismaCommandSettingStore = exports.CommandSettingServiceError = void 0;
exports.createCommandSettingService = createCommandSettingService;
const client_1 = __importDefault(require("../database/client"));
class CommandSettingServiceError extends Error {
    code;
    constructor(code, message) {
        super(message);
        this.code = code;
        this.name = 'CommandSettingServiceError';
    }
}
exports.CommandSettingServiceError = CommandSettingServiceError;
exports.prismaCommandSettingStore = {
    find: (guildId, commandName) => client_1.default.guildCommandSetting.findUnique({
        where: { guildId_commandName: { guildId, commandName } },
        select: {
            guildId: true,
            commandName: true,
            enabled: true,
            updatedByUserId: true,
        },
    }),
    listByGuild: guildId => client_1.default.guildCommandSetting.findMany({
        where: { guildId },
        select: {
            guildId: true,
            commandName: true,
            enabled: true,
            updatedByUserId: true,
        },
    }),
    upsert: input => client_1.default.guildCommandSetting.upsert({
        where: {
            guildId_commandName: {
                guildId: input.guildId,
                commandName: input.commandName,
            },
        },
        create: { ...input },
        update: {
            enabled: input.enabled,
            updatedByUserId: input.updatedByUserId,
        },
        select: {
            guildId: true,
            commandName: true,
            enabled: true,
            updatedByUserId: true,
        },
    }),
};
function createCommandSettingService(store, allowedCommandNames) {
    const commandNames = [...allowedCommandNames];
    const allowedCommands = new Set(commandNames);
    function assertCommandAllowed(commandName) {
        if (!allowedCommands.has(commandName)) {
            throw new CommandSettingServiceError('COMMAND_NOT_ALLOWED', `O comando slash \"${commandName}\" nao pertence ao catalogo permitido.`);
        }
    }
    async function isEnabled(guildId, commandName) {
        assertCommandAllowed(commandName);
        const setting = await store.find(guildId, commandName);
        return setting?.enabled ?? true;
    }
    async function list(guildId) {
        const settings = await store.listByGuild(guildId);
        const settingsByCommand = new Map(settings
            .filter(setting => allowedCommands.has(setting.commandName))
            .map(setting => [setting.commandName, setting.enabled]));
        return commandNames.map(commandName => ({
            commandName,
            enabled: settingsByCommand.get(commandName) ?? true,
        }));
    }
    async function setEnabled(input) {
        assertCommandAllowed(input.commandName);
        return store.upsert({ ...input });
    }
    return { isEnabled, list, setEnabled };
}
//# sourceMappingURL=command-setting-service.js.map