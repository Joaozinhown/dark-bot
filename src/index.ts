import {
  Client,
  Events,
  GatewayIntentBits,
  Collection,
  ChatInputCommandInteraction,
} from 'discord.js';
import dotenv from 'dotenv';
import { readdirSync } from 'fs';
import { join } from 'path';
import http from 'http';

dotenv.config();

interface ClientCommands {
  commands: Collection<string, { execute: (interaction: ChatInputCommandInteraction) => Promise<void> }>;
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers,
  ],
}) as Client & ClientCommands;

client.commands = new Collection<string, { execute: (interaction: ChatInputCommandInteraction) => Promise<void> }>();

function loadCommands() {
  const commandsPath = join(__dirname, 'commands');
  const commandFiles = readdirSync(commandsPath).filter(file => file.endsWith('.js'));

  for (const file of commandFiles) {
    const filePath = join(commandsPath, file);
    const command = require(filePath);

    if ('data' in command && 'execute' in command) {
      client.commands.set(command.data.name, command);
      console.log(`[Commands] Carregado: ${command.data.name}`);
    }
  }
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

  loadCommands();
  loadEvents();

  const token = process.env.DISCORD_TOKEN;
  if (!token) {
    console.error('[Dark Bot] DISCORD_TOKEN nao configurado no .env');
    process.exit(1);
  }

  await client.login(token);

  // HTTP server para manter o servico ativo no Render (free tier)
  const port = parseInt(process.env.PORT || '3000');
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Dark Bot is running!');
  });

  server.listen(port, () => {
    console.log(`[Dark Bot] HTTP server rodando na porta ${port}`);
  });
}

main().catch(error => {
  console.error('[Dark Bot] Erro fatal:', error);
  process.exit(1);
});
