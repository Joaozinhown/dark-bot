"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ADMIN_COMMAND_NAMES = void 0;
exports.createNativeCommandSources = createNativeCommandSources;
exports.buildGuildCommandPayloads = buildGuildCommandPayloads;
exports.composeGuildCommandPayloads = composeGuildCommandPayloads;
exports.syncGuildCommandCatalog = syncGuildCommandCatalog;
const discord_js_1 = require("discord.js");
const client_1 = __importDefault(require("../database/client"));
const compiler_1 = require("./compiler");
const service_1 = require("./service");
exports.ADMIN_COMMAND_NAMES = new Set([
    'criar-confronto',
    'encerrar',
    'gerenciar-cargo',
    'gerenciar-pool',
    'relatorios',
    'resultado',
    'setup-cargo',
]);
function createNativeCommandSources(payloads) {
    return payloads
        .filter((payload) => Boolean(payload && typeof payload === 'object'))
        .map(payload => ({
        payload,
        requireBotAdmin: exports.ADMIN_COMMAND_NAMES.has(String(payload.name ?? '')),
    }));
}
async function buildGuildCommandPayloads(guildId, nativePayloads) {
    const registrations = await service_1.customCommandService.listRegistrationState(guildId);
    return composeGuildCommandPayloads(guildId, nativePayloads, registrations);
}
function composeGuildCommandPayloads(guildId, nativePayloads, registrations) {
    const nativeOverrides = new Map(registrations
        .filter(item => item.command.sourceType === 'native' && item.command.factoryCommandName)
        .map(item => [item.command.factoryCommandName, item]));
    const payloads = [];
    const dynamicByName = new Map();
    for (const nativePayload of nativePayloads) {
        if (!nativePayload || typeof nativePayload !== 'object')
            continue;
        const record = nativePayload;
        const name = String(record.name ?? '');
        const override = nativeOverrides.get(name);
        if (!override) {
            payloads.push(nativePayload);
            continue;
        }
        if (!override.command.enabled)
            continue;
        if (!override.definition) {
            payloads.push(nativePayload);
            continue;
        }
        const compiled = (0, compiler_1.compileDiscordCommand)(override.definition);
        payloads.push(compiled);
        dynamicByName.set(compiled.name, override.command.id);
    }
    for (const item of registrations) {
        if (item.command.sourceType === 'native')
            continue;
        if (!item.command.enabled || !item.definition)
            continue;
        const compiled = (0, compiler_1.compileDiscordCommand)(item.definition);
        payloads.push(compiled);
        dynamicByName.set(compiled.name, item.command.id);
    }
    if (payloads.length > 100) {
        throw new Error(`Servidor ${guildId} excede limite de 100 comandos slash (${payloads.length}).`);
    }
    const names = payloads.map(payload => String(payload.name ?? ''));
    if (new Set(names).size !== names.length) {
        throw new Error(`Servidor ${guildId} possui nomes de comandos slash duplicados.`);
    }
    return { payloads, dynamicByName };
}
async function syncGuildCommandCatalog(token, clientId, guild, nativePayloads) {
    const catalog = await buildGuildCommandPayloads(guild.id, nativePayloads);
    const rest = new discord_js_1.REST({ version: '10' }).setToken(token);
    const response = await rest.put(discord_js_1.Routes.applicationGuildCommands(clientId, guild.id), {
        body: catalog.payloads,
    });
    const idByName = new Map(response.map(command => [command.name, command.id]));
    await client_1.default.$transaction([
        client_1.default.customCommand.updateMany({
            where: { guildId: guild.id },
            data: { discordCommandId: null },
        }),
        ...[...catalog.dynamicByName].flatMap(([name, commandId]) => {
            const discordCommandId = idByName.get(name);
            return discordCommandId
                ? [client_1.default.customCommand.update({ where: { id: commandId }, data: { discordCommandId, status: 'published' } })]
                : [];
        }),
    ]);
    return response.length;
}
//# sourceMappingURL=registry.js.map