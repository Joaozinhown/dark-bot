"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const promises_1 = require("node:fs/promises");
const node_os_1 = require("node:os");
const node_path_1 = require("node:path");
const node_child_process_1 = require("node:child_process");
const node_test_1 = __importDefault(require("node:test"));
const client_1 = require("@prisma/client");
function databaseUrl(path) {
    return `file:${path.replace(/\\/g, '/')}`;
}
function runMigrations(url, backupDirectory) {
    const result = (0, node_child_process_1.spawnSync)(process.execPath, ['scripts/migrate.js'], {
        cwd: process.cwd(),
        env: {
            ...process.env,
            DATABASE_URL: url,
            DATABASE_BACKUP_DIR: backupDirectory,
            PRISMA_HIDE_UPDATE_MESSAGE: '1',
        },
        encoding: 'utf8',
    });
    strict_1.default.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
}
function createClient(url) {
    return new client_1.PrismaClient({ datasources: { db: { url } } });
}
async function listTables(client) {
    const rows = await client.$queryRawUnsafe("SELECT name FROM sqlite_master WHERE type = 'table'");
    return rows.map(row => row.name);
}
(0, node_test_1.default)('deploys migrations on fresh and legacy databases without losing pool data', async () => {
    const directory = await (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), 'dark-bot-migration-'));
    const url = databaseUrl((0, node_path_1.join)(directory, 'migration.db'));
    const backupDirectory = (0, node_path_1.join)(directory, 'backups');
    const client = createClient(url);
    try {
        runMigrations(url, backupDirectory);
        const freshTables = await listTables(client);
        for (const table of ['Pool', 'WebSession', 'AuditLog', 'GuildCommandSetting', 'CustomCommand', 'CustomCommandVersion', 'CustomCommandInteraction']) {
            strict_1.default.equal(freshTables.includes(table), true, `missing fresh table ${table}`);
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
        const backupFiles = await (0, promises_1.readdir)(backupDirectory);
        const backupName = backupFiles.find(name => name.startsWith('pre-admin-panel-foundation-'));
        strict_1.default.ok(backupName, 'migration backup was not created');
        const backupPath = (0, node_path_1.join)(backupDirectory, backupName);
        const backup = createClient(databaseUrl(backupPath));
        try {
            strict_1.default.equal(await backup.pool.count({ where: { guildId: 'guild-legacy' } }), 1);
            strict_1.default.equal(await backup.poolMapa.count({ where: { nome: 'Mapa preservado' } }), 1);
            strict_1.default.equal(await backup.poolKiller.count({ where: { nome: 'Killer preservado' } }), 1);
        }
        finally {
            await backup.$disconnect();
        }
        const migrated = createClient(url);
        try {
            const preserved = await migrated.pool.findFirstOrThrow({
                where: { guildId: 'guild-legacy', nome: 'Pool editada' },
                include: { mapas: true, killers: true },
            });
            strict_1.default.equal(preserved.ativa, false);
            strict_1.default.deepEqual(preserved.mapas.map(item => item.nome), ['Mapa preservado']);
            strict_1.default.deepEqual(preserved.killers.map(item => item.nome), ['Killer preservado']);
            const migratedTables = await listTables(migrated);
            for (const table of ['GuildConfig', 'WebSession', 'AuditLog', 'GuildCommandSetting', 'CustomCommand', 'CustomCommandVersion', 'CustomCommandInteraction']) {
                strict_1.default.equal(migratedTables.includes(table), true, `missing migrated table ${table}`);
            }
            const playerColumns = await migrated.$queryRawUnsafe('PRAGMA table_info("Jogador")');
            strict_1.default.equal(Number(playerColumns.find(column => column.name === 'guildId')?.pk), 2);
        }
        finally {
            await migrated.$disconnect();
        }
    }
    finally {
        await client.$disconnect().catch(() => undefined);
        await (0, promises_1.rm)(directory, { recursive: true, force: true });
    }
});
//# sourceMappingURL=migration-integration.test.js.map