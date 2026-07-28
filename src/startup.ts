import { REST, Routes, Collection, Client, Guild } from 'discord.js';
import { readdirSync } from 'fs';
import { join } from 'path';
import prisma from './database/client';
import { POOL_PRESETS } from './data/pool-presets';
import { createPresetService, PresetStore } from './services/preset-service';

const GUILD_ID = process.env.GUILD_ID!;
const CLIENT_ID = process.env.CLIENT_ID!;
const REGISTER_GUILD_COMMANDS = process.env.REGISTER_GUILD_COMMANDS !== 'false';
const REGISTER_GLOBAL_COMMANDS = process.env.REGISTER_GLOBAL_COMMANDS === 'true';
const CLEAR_GLOBAL_COMMANDS = process.env.CLEAR_GLOBAL_COMMANDS !== 'false';

interface LoadedCommands {
  payloads: any[];
  collection: Collection<string, any>;
}

export async function ensureDatabase(): Promise<void> {
  console.log('[Startup] Verificando conexao com o banco de dados...');

  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('[Startup] Conexao com o banco verificada com sucesso!');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Erro ao verificar conexao com o banco: ${message}`);
  }
}

function loadCommands(): LoadedCommands {
  console.log('[Startup] Carregando comandos da pasta commands/...');

  const commandsPath = join(__dirname, 'commands');
  const commandFiles = readdirSync(commandsPath).filter(file => file.endsWith('.js'));

  const payloads: any[] = [];
  const commandsCollection = new Collection<string, any>();

  for (const file of commandFiles) {
    const filePath = join(commandsPath, file);
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

export async function syncGuildCommands(token: string, guild: Guild, commands: any[]): Promise<void> {
  const rest = new REST({ version: '10' }).setToken(token);
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, guild.id), {
    body: commands,
  });
  console.log(`[Startup] ${commands.length} comandos sincronizados no servidor ${guild.name} (${guild.id}).`);
}

async function syncConnectedGuilds(token: string, client: Client, commands: any[]): Promise<void> {
  if (!REGISTER_GUILD_COMMANDS) return;

  for (const guild of client.guilds.cache.values()) {
    await syncGuildCommands(token, guild, commands);
  }
}

export async function deployCommandsAuto(token: string, client?: Client): Promise<Collection<string, any>> {
  const loadedCommands = loadCommands();
  const commands = loadedCommands.payloads;

  const rest = new REST({ version: '10' }).setToken(token);

  if (REGISTER_GLOBAL_COMMANDS) {
    console.log(`[Startup] ${commands.length} comandos encontrados. Registrando comandos globais...`);
    await rest.put(Routes.applicationCommands(CLIENT_ID), {
      body: commands,
    });
    console.log(`[Startup] ${commands.length} comandos globais registrados com sucesso!`);
  } else if (CLEAR_GLOBAL_COMMANDS) {
    console.log('[Startup] Limpando comandos globais para evitar duplicidade no Discord...');
    await rest.put(Routes.applicationCommands(CLIENT_ID), {
      body: [],
    });
    console.log('[Startup] Comandos globais removidos com sucesso.');
  }

  if (client) {
    await syncConnectedGuilds(token, client, commands);
  } else if (GUILD_ID) {
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
      body: commands,
    });
    console.log(`[Startup] ${commands.length} comandos sincronizados no servidor ${GUILD_ID}.`);
  }

  return loadedCommands.collection;
}

const presetStore: PresetStore = {
  async listPools(guildId) {
    return prisma.pool.findMany({
      where: { guildId },
      select: { nome: true },
    });
  },
  async createPresetPool(guildId, preset) {
    await prisma.pool.create({
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

const presetService = createPresetService(presetStore);

export async function syncPresetPoolsForGuild(guildId: string): Promise<void> {
  await presetService.syncGuild(guildId);

  console.log(`[Startup] ${POOL_PRESETS.length} pools presetadas sincronizadas no servidor ${guildId}.`);
}

export async function seedPools(guildIds: string[] = []): Promise<void> {
  const storedGuilds = await prisma.pool.findMany({
    distinct: ['guildId'],
    select: { guildId: true },
  });
  const allGuildIds = new Set([
    ...storedGuilds.map(pool => pool.guildId),
    ...guildIds,
  ]);

  if (GUILD_ID) allGuildIds.add(GUILD_ID);

  for (const guildId of allGuildIds) {
    await syncPresetPoolsForGuild(guildId);
  }
}
