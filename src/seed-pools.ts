import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const GUILD_ID = '1397269781924548678';

const pools = [
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

async function seed() {
  console.log('Inserindo pools iniciais...');

  for (const poolData of pools) {
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

    console.log(`Pool "${pool.nome}" criada com ${poolData.mapas.length} mapas e ${poolData.killers.length} killers.`);
  }

  console.log('Pools inseridas com sucesso!');
}

seed()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
