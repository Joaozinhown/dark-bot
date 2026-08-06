"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const dotenv_1 = __importDefault(require("dotenv"));
const fs_1 = require("fs");
const path_1 = require("path");
const env_1 = require("./utils/env");
const registry_1 = require("./custom-commands/registry");
const client_1 = __importDefault(require("./database/client"));
dotenv_1.default.config();
async function deployCommands() {
    try {
        console.log('[Deploy] Registrando slash commands...');
        const token = (0, env_1.getDiscordToken)();
        if (!token) {
            throw new Error('DISCORD_TOKEN nao configurado.');
        }
        const tokenError = (0, env_1.getDiscordTokenValidationError)(token);
        if (tokenError) {
            throw new Error(tokenError);
        }
        const clientId = process.env.CLIENT_ID;
        if (!clientId) {
            throw new Error('CLIENT_ID nao configurado.');
        }
        const guildId = process.env.GUILD_ID;
        const commandScope = process.env.COMMAND_SCOPE === 'global' ? 'global' : 'guild';
        if (commandScope === 'guild' && !guildId) {
            throw new Error('GUILD_ID nao configurado para COMMAND_SCOPE=guild.');
        }
        const commandsPath = (0, path_1.join)(__dirname, 'commands');
        const commandFiles = (0, fs_1.readdirSync)(commandsPath).filter(file => file.endsWith('.ts') || file.endsWith('.js'));
        const commands = [];
        for (const file of commandFiles) {
            const command = require((0, path_1.join)(commandsPath, file));
            if ('data' in command) {
                commands.push(command.data.toJSON());
                console.log(`[Deploy] Comando encontrado: ${command.data.name}`);
            }
        }
        const rest = new discord_js_1.REST({ version: '10' }).setToken(token);
        const body = commandScope === 'guild'
            ? (await (0, registry_1.buildGuildCommandPayloads)(guildId, commands)).payloads
            : commands;
        const route = commandScope === 'guild'
            ? discord_js_1.Routes.applicationGuildCommands(clientId, guildId)
            : discord_js_1.Routes.applicationCommands(clientId);
        await rest.put(route, {
            body,
        });
        console.log(`[Deploy] ${body.length} comandos ${commandScope === 'guild' ? 'do servidor' : 'globais'} registrados com sucesso!`);
    }
    catch (error) {
        console.error('[Deploy] Erro ao registrar comandos:', error);
        process.exitCode = 1;
    }
    finally {
        await client_1.default.$disconnect();
    }
}
deployCommands();
//# sourceMappingURL=deploy-commands.js.map