import {
  Client,
  Events,
  GatewayIntentBits,
  Collection,
  ChatInputCommandInteraction,
  GuildMember,
} from 'discord.js';
import dotenv from 'dotenv';
import http from 'http';
import { readdirSync } from 'fs';
import { join } from 'path';
import { getDiscordToken, getDiscordTokenValidationError } from './utils/env';
import {
  deployCommandsAuto,
  seedPools,
  ensureDatabase,
  syncGuildCommands,
  syncPresetPoolsForGuild,
} from './startup';
import { createErrorEmbed } from './utils/embeds';
import { hasBotAdminPermission } from './utils/permissions';
import {
  createCommandSettingService,
  prismaCommandSettingStore,
} from './services/command-setting-service';
import { createDiscordOAuthClient } from './web/auth/discord-oauth';
import { createSessionService } from './web/auth/session-service';
import { readPanelConfig, type EnabledPanelConfig } from './web/config';
import { createPanelRuntime } from './web/runtime';
import { createWebApp } from './web/server';
import { guildEventBus } from './web/realtime/event-bus';
import { readPanelConfigSafely, runPanelBeforeBot } from './web/startup';

dotenv.config();

interface ClientCommands {
  commands: Collection<string, CommandModule>;
}

interface CommandModule {
  data?: {
    toJSON: () => { name?: string; description?: string };
  };
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
  ],
}) as Client & ClientCommands;

client.commands = new Collection<string, CommandModule>();

const ADMIN_COMMANDS = new Set([
  'criar-confronto',
  'encerrar',
  'gerenciar-cargo',
  'gerenciar-pool',
  'relatorios',
  'resultado',
  'setup-cargo',
]);

let commandPayloads: unknown[] = [];

function startHealthServer() {
  const port = parseInt(process.env.PORT || '3000');
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Dark Bot is running!');
  });

  server.listen(port, '0.0.0.0', () => {
    console.log(`[Dark Bot] HTTP server rodando na porta ${port}`);
  });

  return server;
}

async function startAdminPanel(config: EnabledPanelConfig) {
  const oauth = createDiscordOAuthClient({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    redirectUri: config.redirectUri,
  });
  const sessions = createSessionService({
    encryptionKey: config.encryptionKey.toString('base64'),
  });
  const app = await createWebApp({
    config,
    oauth,
    sessions,
    runtime: createPanelRuntime(client),
  });
  await app.listen({ port: config.port, host: '0.0.0.0' });
  console.log(`[Dark Bot] Painel administrativo rodando na porta ${config.port}`);
  return app;
}

function loadEvents() {
  const eventsPath = join(__dirname, 'events');
  const eventFiles = readdirSync(eventsPath).filter(file => file.endsWith('.js'));

  for (const file of eventFiles) {
    const filePath = join(eventsPath, file);
    const event = require(filePath);

    if (event.once) {
      client.once(event.name, (...args: any[]) => event.execute(...args));
    } else {
      client.on(event.name, (...args: any[]) => event.execute(...args));
    }
    console.log(`[Events] Carregado: ${event.name}`);
  }
}

async function waitForClientReady(timeoutMs = 30000): Promise<void> {
  if (client.isReady()) return;

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      client.off(Events.ClientReady, onReady);
      reject(new Error(`Timeout aguardando ClientReady apos ${timeoutMs}ms. Verifique token, invite do bot e intents no Discord Developer Portal.`));
    }, timeoutMs);

    function onReady() {
      clearTimeout(timeout);
      resolve();
    }

    client.once(Events.ClientReady, onReady);
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function loginToDiscord(token: string, timeoutMs = 120000): Promise<void> {
  let timeoutId: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Timeout em client.login apos ${timeoutMs}ms. Verifique conectividade com o Gateway do Discord e se o token pertence ao bot convidado.`));
    }, timeoutMs);
  });

  try {
    await Promise.race([client.login(token), timeoutPromise]);
    await waitForClientReady(timeoutMs);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function connectDiscordWithRetry(token: string): Promise<void> {
  let attempt = 1;

  while (!client.isReady()) {
    try {
      console.log(`[Dark Bot] Conectando ao Gateway do Discord... tentativa ${attempt}`);
      await loginToDiscord(token);
      console.log(`[Dark Bot] Bot online como ${client.user?.tag}`);
      return;
    } catch (error) {
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

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) {
    console.error(`[Commands] Comando nao encontrado: ${interaction.commandName}`);
    return;
  }

  try {
    if (interaction.guildId) {
      const commandSettings = createCommandSettingService(
        prismaCommandSettingStore,
        [...client.commands.keys()],
      );
      if (!(await commandSettings.isEnabled(interaction.guildId, interaction.commandName))) {
        await interaction.reply({
          embeds: [createErrorEmbed('Este comando esta desativado neste servidor.')],
          flags: 64,
        });
        return;
      }
    }

    if (ADMIN_COMMANDS.has(interaction.commandName)) {
      const member = interaction.member instanceof GuildMember ? interaction.member : null;
      const canUseCommand = member ? await hasBotAdminPermission(member) : false;

      if (!canUseCommand) {
        await interaction.reply({
          embeds: [createErrorEmbed('Voce nao tem permissao para usar este comando.')],
          flags: 64,
        });
        return;
      }
    }

    await command.execute(interaction);
    if (interaction.guildId) {
      guildEventBus.publish(interaction.guildId, 'command.executed', {
        commandName: interaction.commandName,
      });
    }
  } catch (error) {
    console.error(`[Commands] Erro ao executar ${interaction.commandName}:`, error);

    const reply = {
      content: 'Ocorreu um erro ao executar este comando.',
      flags: 64,
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(reply);
    } else {
      await interaction.reply(reply);
    }
  }
});

client.on(Events.GuildCreate, async guild => {
  const token = getDiscordToken();
  if (!token || commandPayloads.length === 0) return;

  try {
    await syncPresetPoolsForGuild(guild.id);
    await syncGuildCommands(token, guild, commandPayloads);
    guildEventBus.publish(guild.id, 'guild.connected', { guildId: guild.id });
  } catch (error) {
    console.error(`[Startup] Erro ao sincronizar comandos no servidor ${guild.id}:`, error);
  }
});

async function main() {
  console.log('[Dark Bot] Iniciando...');

  const panelConfig = readPanelConfigSafely({
    readConfig: readPanelConfig,
    reportConfigError(error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[Dark Bot] Painel desabilitado por configuracao invalida: ${message}`);
    },
  });

  if (!panelConfig.enabled && (process.env.ENABLE_HTTP_SERVER === 'true' || process.env.PORT)) {
    startHealthServer();
  }

  loadEvents();

  const token = getDiscordToken();
  if (!token) {
    console.error('[Dark Bot] DISCORD_TOKEN nao configurado. Defina a variavel no painel da hospedagem.');
    process.exit(1);
  }

  const tokenError = getDiscordTokenValidationError(token);
  if (tokenError) {
    console.error(`[Dark Bot] ${tokenError}`);
    process.exit(1);
  }

  await ensureDatabase();

  await runPanelBeforeBot({
    config: panelConfig,
    startPanel: startAdminPanel,
    reportPanelError(error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[Dark Bot] Painel indisponivel; bot continuara iniciando: ${message}`);
    },
    async startBot() {
      await connectDiscordWithRetry(token);

      for (const guildId of client.guilds.cache.keys()) {
        guildEventBus.publish(guildId, 'bot.ready', { guildId });
      }

      await seedPools(Array.from(client.guilds.cache.keys()));

      // Registra comandos apos login (pode demorar)
      client.commands = await deployCommandsAuto(token, client);
      commandPayloads = Array.from(client.commands.values())
        .map((command: CommandModule) => command.data?.toJSON())
        .filter((payload): payload is { name?: string; description?: string } => Boolean(payload));
    },
  });
}

main().catch(error => {
  console.error('[Dark Bot] Erro fatal:', error);
  process.exit(1);
});
