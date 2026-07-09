import { REST, Routes, Collection, Client, Guild } from 'discord.js';
import { readdirSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import prisma from './database/client';

const GUILD_ID = process.env.GUILD_ID!;
const CLIENT_ID = process.env.CLIENT_ID!;
const COMMAND_SCOPE = process.env.COMMAND_SCOPE === 'guild' ? 'guild' : 'global';
const REGISTER_GUILD_COMMANDS = process.env.REGISTER_GUILD_COMMANDS !== 'false';

interface LoadedCommands {
  payloads: any[];
  collection: Collection<string, any>;
}

const INITIAL_POOLS = [
  {
    nome: 'Queens Trials 1',
    formato: 'MD3',
    mapas: [
      "Azarov's Resting Place",
      'Shelter Woods',
      'Ormond Lake Mine',
    ],
    killers: [
      'Oni',
      'Nurse',
      'Spirit',
      'Krasue',
      'Artist',
      'Ghoul',
      'Lich',
      'Plague',
      'Singularity',
    ],
  },
  {
    nome: 'Queens Trials 2',
    formato: 'MD3',
    mapas: [
      'Groaning Storehouse',
      "Wrecker's Yard",
      'Residencia da Familia (Yamaoka)',
    ],
    killers: [
      'The Slasher',
      'Animatronic',
      'Mastermind',
      'Deathslinger',
      'Nightmare',
      'The Executioner',
      'Unknown',
      'Nemesis',
      'Houndmaster',
    ],
  },
  {
    nome: 'Queens Trials 3',
    formato: 'MD5',
    mapas: [
      'Wretched Shop',
      'Midwich Elementary School',
      'Suffocation Pit',
      'Ironworks of Misery',
      "Thompson's House",
    ],
    killers: [
      'Demogorgon',
      'Dredge',
      'Onryo',
      'The First',
      'Wraith',
      'Hillbilly',
      'Blight',
      'Spirit',
      'Pig',
      'Knight',
      'Legion',
    ],
  },
  {
    nome: 'Queens Trials 4',
    formato: 'MD5',
    mapas: [
      'Dead Dawg Saloon',
      'Coal Tower',
      "Lery's Memorial Institute",
      'Blood Lodge',
      'Toba Landing',
    ],
    killers: [
      'Clown',
      'Good Guy',
      'Cenobite',
      'Ghost Face',
      'Shape',
      'Lich',
      'Wraith',
      'Dark Lord',
      'Doctor',
      'Krasue',
      'The Slasher',
    ],
  },
];

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

  console.log(`[Startup] ${commands.length} comandos encontrados. Registrando comandos ${COMMAND_SCOPE === 'guild' ? `no servidor ${GUILD_ID}` : 'globais'}...`);

  const rest = new REST({ version: '10' }).setToken(token);
  const route = COMMAND_SCOPE === 'guild'
    ? Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID)
    : Routes.applicationCommands(CLIENT_ID);

  await rest.put(route, {
    body: commands,
  });

  console.log(`[Startup] ${commands.length} comandos ${COMMAND_SCOPE === 'guild' ? 'do servidor' : 'globais'} registrados com sucesso!`);

  if (COMMAND_SCOPE === 'global' && client) {
    await syncConnectedGuilds(token, client, commands);
  }

  return loadedCommands.collection;
}

export async function seedPools(): Promise<void> {
  const poolCount = await prisma.pool.count();

  if (poolCount > 0) {
    console.log(`[Startup] ${poolCount} pools ja existem. Seed ignorado.`);
    return;
  }

  console.log('[Startup] Nenhuma pool encontrada. Inserindo pools iniciais...');

  for (const poolData of INITIAL_POOLS) {
    const pool = await prisma.pool.create({
      data: {
        guildId: GUILD_ID,
        nome: poolData.nome,
        formato: poolData.formato,
      },
    });

    for (let i = 0; i < poolData.mapas.length; i++) {
      await prisma.poolMapa.create({
        data: {
          poolId: pool.id,
          nome: poolData.mapas[i],
          ordem: i + 1,
        },
      });
    }

    for (let i = 0; i < poolData.killers.length; i++) {
      await prisma.poolKiller.create({
        data: {
          poolId: pool.id,
          nome: poolData.killers[i],
          ordem: i + 1,
        },
      });
    }

    console.log(`[Startup] Pool "${pool.nome}" criada com ${poolData.mapas.length} mapas e ${poolData.killers.length} killers.`);
  }

  console.log('[Startup] Pools iniciais inseridas com sucesso!');
}
