"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureDatabase = ensureDatabase;
exports.syncGuildCommands = syncGuildCommands;
exports.deployCommandsAuto = deployCommandsAuto;
exports.syncPresetPoolsForGuild = syncPresetPoolsForGuild;
exports.seedPools = seedPools;
const discord_js_1 = require("discord.js");
const fs_1 = require("fs");
const path_1 = require("path");
const client_1 = __importDefault(require("./database/client"));
const pool_presets_1 = require("./data/pool-presets");
const preset_service_1 = require("./services/preset-service");
const registry_1 = require("./custom-commands/registry");
const GUILD_ID = process.env.GUILD_ID;
const CLIENT_ID = process.env.CLIENT_ID;
const REGISTER_GUILD_COMMANDS = process.env.REGISTER_GUILD_COMMANDS !== 'false';
const REGISTER_GLOBAL_COMMANDS = process.env.REGISTER_GLOBAL_COMMANDS === 'true';
const CLEAR_GLOBAL_COMMANDS = process.env.CLEAR_GLOBAL_COMMANDS !== 'false';
async function ensureDatabase() {
    console.log('[Startup] Verificando conexao com o banco de dados...');
    try {
        await client_1.default.$queryRaw `SELECT 1`;
        console.log('[Startup] Conexao com o banco verificada com sucesso!');
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Erro ao verificar conexao com o banco: ${message}`);
    }
}
function loadCommands() {
    console.log('[Startup] Carregando comandos da pasta commands/...');
    const commandsPath = (0, path_1.join)(__dirname, 'commands');
    const commandFiles = (0, fs_1.readdirSync)(commandsPath).filter(file => file.endsWith('.js'));
    const payloads = [];
    const commandsCollection = new discord_js_1.Collection();
    for (const file of commandFiles) {
        const filePath = (0, path_1.join)(commandsPath, file);
        const command = require(filePath);
        if ('data' in command && 'execute' in command) {
            payloads.push(command.data.toJSON());
            commandsCollection.set(command.data.name, command);
            console.log(`[Startup] Comando encontrado: ${command.data.name}`);
        }
    }
    return {
        payloads,
        collection: commandsCollection,
    };
}
async function syncGuildCommands(token, guild, commands) {
    const synced = await (0, registry_1.syncGuildCommandCatalog)(token, CLIENT_ID, guild, commands);
    console.log(`[Startup] ${synced} comandos sincronizados no servidor ${guild.name} (${guild.id}).`);
}
async function syncConnectedGuilds(token, client, commands) {
    if (!REGISTER_GUILD_COMMANDS)
        return;
    for (const guild of client.guilds.cache.values()) {
        await syncGuildCommands(token, guild, commands);
    }
}
async function deployCommandsAuto(token, client) {
    const loadedCommands = loadCommands();
    const commands = loadedCommands.payloads;
    const rest = new discord_js_1.REST({ version: '10' }).setToken(token);
    if (REGISTER_GLOBAL_COMMANDS) {
        console.log(`[Startup] ${commands.length} comandos encontrados. Registrando comandos globais...`);
        await rest.put(discord_js_1.Routes.applicationCommands(CLIENT_ID), {
            body: commands,
        });
        console.log(`[Startup] ${commands.length} comandos globais registrados com sucesso!`);
    }
    else if (CLEAR_GLOBAL_COMMANDS) {
        console.log('[Startup] Limpando comandos globais para evitar duplicidade no Discord...');
        await rest.put(discord_js_1.Routes.applicationCommands(CLIENT_ID), {
            body: [],
        });
        console.log('[Startup] Comandos globais removidos com sucesso.');
    }
    if (client) {
        await syncConnectedGuilds(token, client, commands);
    }
    else if (GUILD_ID) {
        const catalog = await (0, registry_1.buildGuildCommandPayloads)(GUILD_ID, commands);
        await rest.put(discord_js_1.Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
            body: catalog.payloads,
        });
        console.log(`[Startup] ${catalog.payloads.length} comandos sincronizados no servidor ${GUILD_ID}.`);
    }
    return loadedCommands.collection;
}
const presetStore = {
    async listPools(guildId) {
        return client_1.default.pool.findMany({
            where: { guildId },
            select: { nome: true },
        });
    },
    async createPresetPool(guildId, preset) {
        await client_1.default.pool.create({
            data: {
                guildId,
                nome: preset.nome,
                formato: preset.formato,
                mapas: {
                    create: preset.mapas.map((nome, index) => ({
                        nome,
                        ordem: index + 1,
                    })),
                },
                killers: {
                    create: preset.killers.map((nome, index) => ({
                        nome,
                        ordem: index + 1,
                    })),
                },
            },
        });
    },
};
const presetService = (0, preset_service_1.createPresetService)(presetStore);
async function syncPresetPoolsForGuild(guildId) {
    await presetService.syncGuild(guildId);
    console.log(`[Startup] ${pool_presets_1.POOL_PRESETS.length} pools presetadas sincronizadas no servidor ${guildId}.`);
}
async function seedPools(guildIds = []) {
    const storedGuilds = await client_1.default.pool.findMany({
        distinct: ['guildId'],
        select: { guildId: true },
    });
    const allGuildIds = new Set([
        ...storedGuilds.map(pool => pool.guildId),
        ...guildIds,
    ]);
    if (GUILD_ID)
        allGuildIds.add(GUILD_ID);
    for (const guildId of allGuildIds) {
        await syncPresetPoolsForGuild(guildId);
    }
}
//# sourceMappingURL=startup.js.map