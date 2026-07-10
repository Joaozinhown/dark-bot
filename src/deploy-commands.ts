import { REST, Routes } from 'discord.js';
import dotenv from 'dotenv';
import { readdirSync } from 'fs';
import { join } from 'path';
import { getDiscordToken, getDiscordTokenValidationError } from './utils/env';

dotenv.config();

async function deployCommands() {
  try {
    console.log('[Deploy] Registrando slash commands...');

    const token = getDiscordToken();
    if (!token) {
      throw new Error('DISCORD_TOKEN nao configurado.');
    }

    const tokenError = getDiscordTokenValidationError(token);
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

    const commandsPath = join(__dirname, 'commands');
    const commandFiles = readdirSync(commandsPath).filter(file => file.endsWith('.ts') || file.endsWith('.js'));
    const commands = [];

    for (const file of commandFiles) {
      const command = require(join(commandsPath, file));

      if ('data' in command) {
        commands.push(command.data.toJSON());
        console.log(`[Deploy] Comando encontrado: ${command.data.name}`);
      }
    }

    const rest = new REST({ version: '10' }).setToken(token);
    const route = commandScope === 'guild'
      ? Routes.applicationGuildCommands(clientId, guildId!)
      : Routes.applicationCommands(clientId);

    await rest.put(route, {
      body: commands,
    });

    console.log(`[Deploy] ${commands.length} comandos ${commandScope === 'guild' ? 'do servidor' : 'globais'} registrados com sucesso!`);
  } catch (error) {
    console.error('[Deploy] Erro ao registrar comandos:', error);
    process.exit(1);
  }
}

deployCommands();
