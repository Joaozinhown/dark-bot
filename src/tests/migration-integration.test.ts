import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { PrismaClient } from '@prisma/client';

function databaseUrl(path: string): string {
  return `file:${path.replace(/\\/g, '/')}`;
}

function runMigrations(url: string, backupDirectory: string): void {
  const result = spawnSync(process.execPath, ['scripts/migrate.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DATABASE_URL: url,
      DATABASE_BACKUP_DIR: backupDirectory,
      PRISMA_HIDE_UPDATE_MESSAGE: '1',
    },
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
}

function createClient(url: string): PrismaClient {
  return new PrismaClient({ datasources: { db: { url } } });
}

async function listTables(client: PrismaClient): Promise<string[]> {
  const rows = await client.$queryRawUnsafe<Array<{ name: string }>>(
    "SELECT name FROM sqlite_master WHERE type = 'table'",
  );
  return rows.map(row => row.name);
}

test('deploys migrations on fresh and legacy databases without losing pool data', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dark-bot-migration-'));
  const url = databaseUrl(join(directory, 'migration.db'));
  const backupDirectory = join(directory, 'backups');
  const client = createClient(url);

  try {
    runMigrations(url, backupDirectory);

    const freshTables = await listTables(client);
    for (const table of ['Pool', 'WebSession', 'AuditLog', 'GuildCommandSetting', 'CustomCommand', 'CustomCommandVersion', 'CustomCommandInteraction']) {
      assert.equal(freshTables.includes(table), true, `missing fresh table ${table}`);
    }

    await client.pool.create({
      data: {
        guildId: 'guild-legacy',
        nome: 'Pool editada',
        formato: 'MD5',
        ativa: false,
        mapas: { create: [{ nome: 'Mapa preservado', ordem: 1 }] },
        killers: { create: [{ nome: 'Killer preservado', ordem: 1 }] },
      },
    });

    for (const table of ['WebSession', 'AuditLog', 'GuildCommandSetting', 'CustomCommand']) {
      await client.$executeRawUnsafe(`DROP TABLE "${table}"`);
    }
    await client.$executeRawUnsafe('DROP TABLE "GuildConfig"');
    await client.$executeRawUnsafe(`
      CREATE TABLE "old_Jogador" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "guildId" TEXT NOT NULL,
        "nome" TEXT NOT NULL,
        "vitorias" INTEGER NOT NULL DEFAULT 0,
        "derrotas" INTEGER NOT NULL DEFAULT 0,
        "confrontos" INTEGER NOT NULL DEFAULT 0
      )
    `);
    await client.$executeRawUnsafe(`
      INSERT INTO "old_Jogador" ("id", "guildId", "nome", "vitorias", "derrotas", "confrontos")
      SELECT "id", "guildId", "nome", "vitorias", "derrotas", "confrontos" FROM "Jogador"
    `);
    await client.$executeRawUnsafe('DROP TABLE "Jogador"');
    await client.$executeRawUnsafe('ALTER TABLE "old_Jogador" RENAME TO "Jogador"');
    await client.$executeRawUnsafe('CREATE UNIQUE INDEX "Jogador_id_guildId_key" ON "Jogador"("id", "guildId")');
    await client.$executeRawUnsafe('DROP TABLE "_prisma_migrations"');
    await client.$disconnect();

    runMigrations(url, backupDirectory);
    const backupFiles = await readdir(backupDirectory);
    const backupName = backupFiles.find(name => name.startsWith('pre-admin-panel-foundation-'));
    assert.ok(backupName, 'migration backup was not created');
    const backupPath = join(backupDirectory, backupName);

    const backup = createClient(databaseUrl(backupPath));
    try {
      assert.equal(await backup.pool.count({ where: { guildId: 'guild-legacy' } }), 1);
      assert.equal(await backup.poolMapa.count({ where: { nome: 'Mapa preservado' } }), 1);
      assert.equal(await backup.poolKiller.count({ where: { nome: 'Killer preservado' } }), 1);
    } finally {
      await backup.$disconnect();
    }

    const migrated = createClient(url);
    try {
      const preserved = await migrated.pool.findFirstOrThrow({
        where: { guildId: 'guild-legacy', nome: 'Pool editada' },
        include: { mapas: true, killers: true },
      });
      assert.equal(preserved.ativa, false);
      assert.deepEqual(preserved.mapas.map(item => item.nome), ['Mapa preservado']);
      assert.deepEqual(preserved.killers.map(item => item.nome), ['Killer preservado']);

      const migratedTables = await listTables(migrated);
      for (const table of ['GuildConfig', 'WebSession', 'AuditLog', 'GuildCommandSetting', 'CustomCommand', 'CustomCommandVersion', 'CustomCommandInteraction']) {
        assert.equal(migratedTables.includes(table), true, `missing migrated table ${table}`);
      }
      const playerColumns = await migrated.$queryRawUnsafe<Array<{ name: string; pk: bigint | number }>>(
        'PRAGMA table_info("Jogador")',
      );
      assert.equal(Number(playerColumns.find(column => column.name === 'guildId')?.pk), 2);
    } finally {
      await migrated.$disconnect();
    }
  } finally {
    await client.$disconnect().catch(() => undefined);
    await rm(directory, { recursive: true, force: true });
  }
});
