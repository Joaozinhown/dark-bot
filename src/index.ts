import {
  Client,
  Events,
  GatewayIntentBits,
  Collection,
  ChatInputCommandInteraction,
} from 'discord.js';
import dotenv from 'dotenv';
import http from 'http';
import { readdirSync } from 'fs';
import { join } from 'path';
import { getDiscordToken, getDiscordTokenValidationError } from './utils/env';
import { deployCommandsAuto, seedPools, ensureDatabase } from './startup';

dotenv.config();

interface ClientCommands {
  commands: Collection<string, { execute: (interaction: ChatInputCommandInteraction) => Promise<void> }>;
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
  ],
}) as Client & ClientCommands;

client.commands = new Collection<string, { execute: (interaction: ChatInputCommandInteraction) => Promise<void> }>();

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

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) {
    console.error(`[Commands] Comando nao encontrado: ${interaction.commandName}`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`[Commands] Erro ao executar ${interaction.commandName}:`, error);

    const reply = {
      content: 'Ocorreu um erro ao executar este comando.',
      ephemeral: true,
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(reply);
    } else {
      await interaction.reply(reply);
    }
  }
});

async function main() {
  console.log('[Dark Bot] Iniciando...');

  startHealthServer();
  loadEvents();

  const token = getDiscordToken();
  if (!token) {
    console.error('[Dark Bot] DISCORD_TOKEN nao configurado. No Render, defina em Environment Variables.');
    process.exit(1);
  }

  const tokenError = getDiscordTokenValidationError(token);
  if (tokenError) {
    console.error(`[Dark Bot] ${tokenError}`);
    process.exit(1);
  }

  // Verifica DATABASE_URL antes de tentar seed
  if (!process.env.DATABASE_URL) {
    console.error('[Dark Bot] DATABASE_URL nao configurada.');
    process.exit(1);
  }

  // Sincroniza schema do banco (cria tabelas se nao existirem)
  ensureDatabase();

  // Semeia pools caso o banco esteja vazio
  await seedPools();

  console.log('[Dark Bot] Conectando ao Gateway do Discord...');
  await client.login(token);
  await waitForClientReady();
  console.log(`[Dark Bot] Bot online como ${client.user?.tag}`);

  // Registra comandos apos login (pode demorar)
  client.commands = await deployCommandsAuto(token);
}

main().catch(error => {
  console.error('[Dark Bot] Erro fatal:', error);
  process.exit(1);
});
