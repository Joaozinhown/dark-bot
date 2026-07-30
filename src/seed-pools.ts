import { PrismaClient } from '@prisma/client';
import { POOL_PRESETS } from './data/pool-presets';

const prisma = new PrismaClient();

const GUILD_ID = '1397269781924548678';

async function seed() {
  console.log('Inserindo pools iniciais...');

  for (const poolData of POOL_PRESETS) {
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
