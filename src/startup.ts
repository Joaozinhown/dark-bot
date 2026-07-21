import { REST, Routes, Collection, Client, Guild } from 'discord.js';
import { readdirSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import prisma from './database/client';
import { POOL_PRESETS } from './data/pool-presets';

const GUILD_ID = process.env.GUILD_ID!;
const CLIENT_ID = process.env.CLIENT_ID!;
const REGISTER_GUILD_COMMANDS = process.env.REGISTER_GUILD_COMMANDS !== 'false';
const REGISTER_GLOBAL_COMMANDS = process.env.REGISTER_GLOBAL_COMMANDS === 'true';
const CLEAR_GLOBAL_COMMANDS = process.env.CLEAR_GLOBAL_COMMANDS !== 'false';

interface LoadedCommands {
  payloads: any[];
  collection: Collection<string, any>;
}

export function ensureDatabase(): void {
  console.log(`[Startup] DATABASE_URL: ${process.env.DATABASE_URL}`);
  console.log('[Startup] Sincronizando schema do banco de dados...');

  try {
    execSync('npx prisma db push --skip-generate --accept-data-loss', {
      env: {
        ...process.env,
        PRISMA_HIDE_UPDATE_MESSAGE: process.env.PRISMA_HIDE_UPDATE_MESSAGE ?? '1',
      },
      stdio: 'pipe',
      timeout: 30000,
    });
    console.log('[Startup] Schema do banco sincronizado com sucesso!');
  } catch (error: any) {
    console.error('[Startup] Erro ao sincronizar schema:', error.stderr?.toString() || error.message);
    process.exit(1);
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

export async function syncPresetPoolsForGuild(guildId: string): Promise<void> {
  await prisma.$transaction(async transaction => {
    const existingPools = await transaction.pool.findMany({
      where: { guildId },
      orderBy: { id: 'asc' },
    });

    await transaction.pool.updateMany({
      where: { guildId },
      data: { ativa: false },
    });

    for (const preset of POOL_PRESETS) {
      const existingPool = existingPools.find(pool => pool.nome === preset.nome);
      const pool = existingPool
        ? await transaction.pool.update({
          where: { id: existingPool.id },
          data: { formato: preset.formato, ativa: true },
        })
        : await transaction.pool.create({
          data: {
            guildId,
            nome: preset.nome,
            formato: preset.formato,
          },
        });

      await transaction.poolMapa.deleteMany({ where: { poolId: pool.id } });
      await transaction.poolKiller.deleteMany({ where: { poolId: pool.id } });

      await transaction.poolMapa.createMany({
        data: preset.mapas.map((nome, index) => ({
          poolId: pool.id,
          nome,
          ordem: index + 1,
        })),
      });
      await transaction.poolKiller.createMany({
        data: preset.killers.map((nome, index) => ({
          poolId: pool.id,
          nome,
          ordem: index + 1,
        })),
      });
    }
  });

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
