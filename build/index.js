"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const dotenv_1 = __importDefault(require("dotenv"));
const http_1 = __importDefault(require("http"));
const fs_1 = require("fs");
const path_1 = require("path");
const env_1 = require("./utils/env");
const startup_1 = require("./startup");
const embeds_1 = require("./utils/embeds");
const permissions_1 = require("./utils/permissions");
const command_setting_service_1 = require("./services/command-setting-service");
const discord_oauth_1 = require("./web/auth/discord-oauth");
const session_service_1 = require("./web/auth/session-service");
const config_1 = require("./web/config");
const runtime_1 = require("./web/runtime");
const server_1 = require("./web/server");
const event_bus_1 = require("./web/realtime/event-bus");
const startup_2 = require("./web/startup");
const audit_service_1 = require("./services/audit-service");
const service_1 = require("./custom-commands/service");
const executor_1 = require("./custom-commands/executor");
const registry_1 = require("./custom-commands/registry");
dotenv_1.default.config();
const client = new discord_js_1.Client({
    intents: [
        discord_js_1.GatewayIntentBits.Guilds,
        discord_js_1.GatewayIntentBits.GuildVoiceStates,
    ],
});
client.commands = new discord_js_1.Collection();
let commandPayloads = [];
function startHealthServer() {
    const port = parseInt(process.env.PORT || '3000');
    const server = http_1.default.createServer((_req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Dark Bot is running!');
    });
    server.listen(port, '0.0.0.0', () => {
        console.log(`[Dark Bot] HTTP server rodando na porta ${port}`);
    });
    return server;
}
async function startAdminPanel(config) {
    const oauth = (0, discord_oauth_1.createDiscordOAuthClient)({
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        redirectUri: config.redirectUri,
    });
    const sessions = (0, session_service_1.createSessionService)({
        encryptionKey: config.encryptionKey.toString('base64'),
    });
    const app = await (0, server_1.createWebApp)({
        config,
        oauth,
        sessions,
        runtime: (0, runtime_1.createPanelRuntime)(client),
    });
    await app.listen({ port: config.port, host: '0.0.0.0' });
    console.log(`[Dark Bot] Painel administrativo rodando na porta ${config.port}`);
    return app;
}
function loadEvents() {
    const eventsPath = (0, path_1.join)(__dirname, 'events');
    const eventFiles = (0, fs_1.readdirSync)(eventsPath).filter(file => file.endsWith('.js'));
    for (const file of eventFiles) {
        const filePath = (0, path_1.join)(eventsPath, file);
        const event = require(filePath);
        if (event.once) {
            client.once(event.name, (...args) => event.execute(...args));
        }
        else {
            client.on(event.name, (...args) => event.execute(...args));
        }
        console.log(`[Events] Carregado: ${event.name}`);
    }
}
async function waitForClientReady(timeoutMs = 30000) {
    if (client.isReady())
        return;
    await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            client.off(discord_js_1.Events.ClientReady, onReady);
            reject(new Error(`Timeout aguardando ClientReady apos ${timeoutMs}ms. Verifique token, invite do bot e intents no Discord Developer Portal.`));
        }, timeoutMs);
        function onReady() {
            clearTimeout(timeout);
            resolve();
        }
        client.once(discord_js_1.Events.ClientReady, onReady);
    });
}
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
async function loginToDiscord(token, timeoutMs = 120000) {
    let timeoutId;
    const timeoutPromise = new Promise((_resolve, reject) => {
        timeoutId = setTimeout(() => {
            reject(new Error(`Timeout em client.login apos ${timeoutMs}ms. Verifique conectividade com o Gateway do Discord e se o token pertence ao bot convidado.`));
        }, timeoutMs);
    });
    try {
        await Promise.race([client.login(token), timeoutPromise]);
        await waitForClientReady(timeoutMs);
    }
    finally {
        if (timeoutId)
            clearTimeout(timeoutId);
    }
}
async function connectDiscordWithRetry(token) {
    let attempt = 1;
    while (!client.isReady()) {
        try {
            console.log(`[Dark Bot] Conectando ao Gateway do Discord... tentativa ${attempt}`);
            await loginToDiscord(token);
            console.log(`[Dark Bot] Bot online como ${client.user?.tag}`);
            return;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            const fatalConfigError = /invalid token|disallowed intents|privileged intent/i.test(message);
            if (fatalConfigError) {
                console.error(`[Dark Bot] Erro fatal de configuracao do Discord: ${message}`);
                process.exit(1);
            }
            client.destroy();
            const delayMs = Math.min(300000, attempt * 30000);
            console.warn(`[Dark Bot] Falha ao conectar no Discord: ${message}`);
            console.warn(`[Dark Bot] Nova tentativa em ${Math.round(delayMs / 1000)}s para evitar rate limit.`);
            await sleep(delayMs);
            attempt += 1;
        }
    }
}
client.on(discord_js_1.Events.InteractionCreate, async (interaction) => {
    try {
        if (interaction.isButton() || interaction.isStringSelectMenu() || interaction.isModalSubmit()) {
            if (await (0, executor_1.handleDynamicComponent)(interaction))
                return;
            return;
        }
        if (!interaction.isChatInputCommand())
            return;
        const dynamic = interaction.guildId
            ? await service_1.customCommandService.findPublishedByDiscordId(interaction.guildId, interaction.commandId)
            : null;
        const factoryName = dynamic?.definition.execution.factoryCommandName ?? interaction.commandName;
        const command = client.commands.get(factoryName);
        if (dynamic) {
            const permission = await (0, executor_1.canExecuteDynamicCommand)(interaction, dynamic.definition, dynamic.command.id);
            if (!permission.allowed) {
                await interaction.reply({
                    embeds: [(0, embeds_1.createErrorEmbed)(permission.message)],
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
                return;
            }
            if (dynamic.definition.execution.mode === 'native') {
                if (!command)
                    throw new Error(`Handler nativo nao encontrado: ${factoryName}`);
                await command.execute((0, executor_1.adaptInteractionForNativeHandler)(interaction, dynamic.definition, factoryName));
            }
            else {
                await (0, executor_1.executeDynamicCommand)(interaction, {
                    commandId: dynamic.command.id,
                    versionId: dynamic.version.id,
                    definition: dynamic.definition,
                });
            }
            await audit_service_1.auditService.write({
                guildId: interaction.guildId,
                actorUserId: interaction.user.id,
                action: 'command.executed',
                entityType: 'command',
                entityId: String(dynamic.command.id),
                details: {
                    commandName: dynamic.definition.command.name.ptBR,
                    version: dynamic.version.version,
                    executionMode: dynamic.definition.execution.mode,
                    actorDisplayName: interaction.member instanceof discord_js_1.GuildMember ? interaction.member.displayName : interaction.user.globalName,
                    actorUsername: interaction.user.username,
                },
            });
            event_bus_1.guildEventBus.publish(interaction.guildId, 'command.executed', {
                commandName: dynamic.definition.command.name.ptBR,
                commandId: dynamic.command.id,
                dynamic: true,
            });
            return;
        }
        if (!command) {
            console.error(`[Commands] Comando nao encontrado: ${interaction.commandName}`);
            await interaction.reply({ content: 'Este comando nao esta disponivel.', flags: discord_js_1.MessageFlags.Ephemeral });
            return;
        }
        if (interaction.guildId) {
            const commandSettings = (0, command_setting_service_1.createCommandSettingService)(command_setting_service_1.prismaCommandSettingStore, [...client.commands.keys()]);
            if (!(await commandSettings.isEnabled(interaction.guildId, interaction.commandName))) {
                await interaction.reply({
                    embeds: [(0, embeds_1.createErrorEmbed)('Este comando esta desativado neste servidor.')],
                    flags: 64,
                });
                return;
            }
        }
        if (registry_1.ADMIN_COMMAND_NAMES.has(interaction.commandName)) {
            const member = interaction.member instanceof discord_js_1.GuildMember ? interaction.member : null;
            const canUseCommand = member ? await (0, permissions_1.hasBotAdminPermission)(member) : false;
            if (!canUseCommand) {
                await interaction.reply({
                    embeds: [(0, embeds_1.createErrorEmbed)('Voce nao tem permissao para usar este comando.')],
                    flags: 64,
                });
                return;
            }
        }
        await command.execute(interaction);
        if (interaction.guildId) {
            await audit_service_1.auditService.write({
                guildId: interaction.guildId,
                actorUserId: interaction.user.id,
                action: 'command.executed',
                entityType: 'command',
                entityId: interaction.commandName,
                details: {
                    commandName: interaction.commandName,
                    executionMode: 'factory',
                    actorDisplayName: interaction.member instanceof discord_js_1.GuildMember ? interaction.member.displayName : interaction.user.globalName,
                    actorUsername: interaction.user.username,
                },
            });
            event_bus_1.guildEventBus.publish(interaction.guildId, 'command.executed', {
                commandName: interaction.commandName,
            });
        }
    }
    catch (error) {
        const interactionName = interaction.isChatInputCommand()
            ? interaction.commandName
            : 'customId' in interaction ? interaction.customId : interaction.id;
        console.error(`[Commands] Erro ao executar ${interactionName}:`, error);
        const reply = {
            content: 'Ocorreu um erro ao executar este comando.',
            flags: 64,
        };
        if (!interaction.isRepliable())
            return;
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(reply);
        }
        else {
            await interaction.reply(reply);
        }
    }
});
client.on(discord_js_1.Events.GuildCreate, async (guild) => {
    const token = (0, env_1.getDiscordToken)();
    if (!token || commandPayloads.length === 0)
        return;
    try {
        await (0, startup_1.syncPresetPoolsForGuild)(guild.id);
        await (0, startup_1.syncGuildCommands)(token, guild, commandPayloads);
        event_bus_1.guildEventBus.publish(guild.id, 'guild.connected', { guildId: guild.id });
    }
    catch (error) {
        console.error(`[Startup] Erro ao sincronizar comandos no servidor ${guild.id}:`, error);
    }
});
async function main() {
    console.log('[Dark Bot] Iniciando...');
    const panelConfig = (0, startup_2.readPanelConfigSafely)({
        readConfig: config_1.readPanelConfig,
        reportConfigError(error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error(`[Dark Bot] Painel desabilitado por configuracao invalida: ${message}`);
        },
    });
    if (!panelConfig.enabled && (process.env.ENABLE_HTTP_SERVER === 'true' || process.env.PORT)) {
        startHealthServer();
    }
    loadEvents();
    const token = (0, env_1.getDiscordToken)();
    if (!token) {
        console.error('[Dark Bot] DISCORD_TOKEN nao configurado. Defina a variavel no painel da hospedagem.');
        process.exit(1);
    }
    const tokenError = (0, env_1.getDiscordTokenValidationError)(token);
    if (tokenError) {
        console.error(`[Dark Bot] ${tokenError}`);
        process.exit(1);
    }
    await (0, startup_1.ensureDatabase)();
    await (0, startup_2.runPanelBeforeBot)({
        config: panelConfig,
        startPanel: startAdminPanel,
        reportPanelError(error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error(`[Dark Bot] Painel indisponivel; bot continuara iniciando: ${message}`);
        },
        async startBot() {
            await connectDiscordWithRetry(token);
            for (const guildId of client.guilds.cache.keys()) {
                event_bus_1.guildEventBus.publish(guildId, 'bot.ready', { guildId });
            }
            await (0, startup_1.seedPools)(Array.from(client.guilds.cache.keys()));
            // Registra comandos apos login (pode demorar)
            client.commands = await (0, startup_1.deployCommandsAuto)(token, client);
            commandPayloads = Array.from(client.commands.values())
                .map((command) => command.data?.toJSON())
                .filter((payload) => Boolean(payload));
        },
    });
}
main().catch(error => {
    console.error('[Dark Bot] Erro fatal:', error);
    process.exit(1);
});
//# sourceMappingURL=index.js.map