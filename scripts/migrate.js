const { spawnSync } = require("child_process");
const { PrismaClient } = require("@prisma/client");
const { existsSync, mkdirSync } = require("fs");
const { join } = require("path");

const BASELINE_MIGRATION = "20260728000000_baseline";
const BASELINE_TABLE_COLUMNS = Object.freeze({
  Pool: ["id", "guildId", "nome", "formato", "ativa", "criadoEm"],
  GuildConfig: ["guildId", "adminRoleIds", "criadoEm", "atualizadoEm"],
  PoolMapa: ["id", "poolId", "nome", "ordem"],
  PoolKiller: ["id", "poolId", "nome", "ordem"],
  Confronto: [
    "id", "guildId", "poolId", "formato", "timeARoleId", "timeBRoleId",
    "timeAVitorias", "timeBVitorias", "status", "currentSet", "channelId",
    "vozTimeAId", "vozTimeBId", "vencedor", "primeiroKiller", "encerradoEm",
    "motivoEncerramento", "criadoEm",
  ],
  Set: [
    "id", "confrontoId", "numero", "vencedorTime", "mapaUsado", "killerUsado",
    "killerTime", "jogadoEm",
  ],
  VetoState: [
    "id", "confrontoId", "tipo", "set", "vezDe", "mapasRestantes",
    "killersRestantes", "mapaEscolhido", "killerEscolhido", "messageId",
  ],
  Jogador: ["id", "guildId", "nome", "vitorias", "derrotas", "confrontos"],
});
const BASELINE_INDEXES = Object.freeze({
  Pool_id_guildId_key: Object.freeze({ table: "Pool", unique: 1, columns: ["id", "guildId"] }),
  VetoState_confrontoId_key: Object.freeze({ table: "VetoState", unique: 1, columns: ["confrontoId"] }),
});
const LEGACY_ADDITIVE_COLUMNS = Object.freeze({
  Confronto: Object.freeze({ primeiroKiller: "TEXT" }),
  Set: Object.freeze({ killerTime: "TEXT" }),
});
const NULLABLE_COLUMNS = new Set([
  "Confronto.channelId", "Confronto.vozTimeAId", "Confronto.vozTimeBId",
  "Confronto.vencedor", "Confronto.primeiroKiller", "Confronto.encerradoEm",
  "Confronto.motivoEncerramento", "Set.vencedorTime", "Set.mapaUsado",
  "Set.killerUsado", "Set.killerTime", "Set.jogadoEm", "VetoState.mapaEscolhido",
  "VetoState.killerEscolhido", "VetoState.messageId",
]);
const INTEGER_COLUMNS = new Set([
  "Pool.id", "PoolMapa.id", "PoolMapa.poolId", "PoolMapa.ordem",
  "PoolKiller.id", "PoolKiller.poolId", "PoolKiller.ordem", "Confronto.id",
  "Confronto.poolId", "Confronto.timeAVitorias", "Confronto.timeBVitorias",
  "Confronto.currentSet", "Set.id", "Set.confrontoId", "Set.numero",
  "VetoState.id", "VetoState.confrontoId", "VetoState.set", "Jogador.vitorias",
  "Jogador.derrotas", "Jogador.confrontos",
]);
const DATETIME_COLUMNS = new Set([
  "Pool.criadoEm", "GuildConfig.criadoEm", "GuildConfig.atualizadoEm",
  "Confronto.encerradoEm", "Confronto.criadoEm", "Set.jogadoEm",
]);
const COLUMN_DEFAULTS = Object.freeze({
  "Pool.ativa": "true",
  "Pool.criadoEm": "CURRENT_TIMESTAMP",
  "GuildConfig.adminRoleIds": "'[]'",
  "GuildConfig.criadoEm": "CURRENT_TIMESTAMP",
  "Confronto.timeAVitorias": "0",
  "Confronto.timeBVitorias": "0",
  "Confronto.status": "'aguardando'",
  "Confronto.currentSet": "1",
  "Confronto.criadoEm": "CURRENT_TIMESTAMP",
  "Jogador.vitorias": "0",
  "Jogador.derrotas": "0",
  "Jogador.confrontos": "0",
});
const PRIMARY_KEYS = Object.freeze({
  "Pool.id": 1,
  "GuildConfig.guildId": 1,
  "PoolMapa.id": 1,
  "PoolKiller.id": 1,
  "Confronto.id": 1,
  "Set.id": 1,
  "VetoState.id": 1,
  "Jogador.id": 1,
  "Jogador.guildId": 2,
});
const FOREIGN_KEYS = Object.freeze({
  PoolMapa: ["poolId:Pool.id:CASCADE:CASCADE"],
  PoolKiller: ["poolId:Pool.id:CASCADE:CASCADE"],
  Confronto: ["poolId:Pool.id:RESTRICT:CASCADE"],
  Set: ["confrontoId:Confronto.id:RESTRICT:CASCADE"],
  VetoState: ["confrontoId:Confronto.id:RESTRICT:CASCADE"],
});

process.env.DATABASE_URL ||= "file:./prisma/darkbot.db";
process.env.PRISMA_HIDE_UPDATE_MESSAGE ||= "1";

const prismaCli = require.resolve("prisma/build/index.js");

function runPrisma(args) {
  const result = spawnSync(process.execPath, [prismaCli, ...args], {
    env: process.env,
    shell: false,
    stdio: "inherit",
  });

  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

async function getTableNames(prisma) {
  const rows = await prisma.$queryRawUnsafe(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
  );
  return new Set(rows.map(row => row.name));
}

async function validateLegacyBaseline(prisma, tableNames) {
  const errors = [];

  for (const [tableName, expectedColumns] of Object.entries(BASELINE_TABLE_COLUMNS)) {
    if (!tableNames.has(tableName)) {
      errors.push(`missing table ${tableName}`);
      continue;
    }

    const rows = await prisma.$queryRawUnsafe(`PRAGMA table_info("${tableName}")`);
    const actualColumns = rows.map(row => row.name).sort();
    const expected = [...expectedColumns].sort();

    if (actualColumns.join("\0") !== expected.join("\0")) {
      const missing = expected.filter(column => !actualColumns.includes(column));
      const extra = actualColumns.filter(column => !expected.includes(column));
      if (missing.length) errors.push(`${tableName} missing columns: ${missing.join(", ")}`);
      if (extra.length) errors.push(`${tableName} unexpected columns: ${extra.join(", ")}`);
    }

    for (const row of rows) {
      if (!expectedColumns.includes(row.name)) continue;
      const key = `${tableName}.${row.name}`;
      const expectedType = key === "Pool.ativa"
        ? "BOOLEAN"
        : DATETIME_COLUMNS.has(key)
          ? "DATETIME"
          : INTEGER_COLUMNS.has(key)
            ? "INTEGER"
            : "TEXT";
      const expectedNotNull = NULLABLE_COLUMNS.has(key) ? 0 : 1;
      const expectedPrimaryKey = PRIMARY_KEYS[key] ?? 0;
      const expectedDefault = COLUMN_DEFAULTS[key] ?? null;

      if (String(row.type).toUpperCase() !== expectedType) {
        errors.push(`${key} type ${row.type} != ${expectedType}`);
      }
      if (Number(row.notnull) !== expectedNotNull) {
        errors.push(`${key} not-null ${row.notnull} != ${expectedNotNull}`);
      }
      if (Number(row.pk) !== expectedPrimaryKey) {
        errors.push(`${key} primary-key order ${row.pk} != ${expectedPrimaryKey}`);
      }
      if ((row.dflt_value ?? null) !== expectedDefault) {
        errors.push(`${key} default ${row.dflt_value} != ${expectedDefault}`);
      }
    }

    const foreignKeyRows = await prisma.$queryRawUnsafe(`PRAGMA foreign_key_list("${tableName}")`);
    const actualForeignKeys = foreignKeyRows.map(row =>
      `${row.from}:${row.table}.${row.to}:${row.on_delete}:${row.on_update}`,
    ).sort();
    const expectedForeignKeys = [...(FOREIGN_KEYS[tableName] ?? [])].sort();
    if (actualForeignKeys.join("\0") !== expectedForeignKeys.join("\0")) {
      errors.push(`${tableName} foreign keys do not match the baseline`);
    }
  }

  const indexRows = await prisma.$queryRawUnsafe(
    "SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%'",
  );
  const indexNames = new Set(indexRows.map(row => row.name));
  for (const [indexName, expectedIndex] of Object.entries(BASELINE_INDEXES)) {
    if (!indexNames.has(indexName)) {
      errors.push(`missing index ${indexName}`);
      continue;
    }

    const indexList = await prisma.$queryRawUnsafe(`PRAGMA index_list("${expectedIndex.table}")`);
    const actualIndex = indexList.find(row => row.name === indexName);
    const indexColumns = await prisma.$queryRawUnsafe(`PRAGMA index_info("${indexName}")`);
    const actualColumns = indexColumns
      .sort((left, right) => Number(left.seqno) - Number(right.seqno))
      .map(row => row.name);

    if (Number(actualIndex?.unique) !== expectedIndex.unique) {
      errors.push(`${indexName} uniqueness does not match the baseline`);
    }
    if (actualColumns.join("\0") !== expectedIndex.columns.join("\0")) {
      errors.push(`${indexName} columns do not match the baseline`);
    }
  }

  const integrityErrors = await prisma.$queryRawUnsafe("PRAGMA foreign_key_check");
  if (integrityErrors.length) errors.push("foreign key integrity check failed");

  if (errors.length) {
    throw new Error(
      `Legacy database does not match the pre-panel baseline: ${errors.join("; ")}. ` +
      "Migration was stopped without marking the baseline as applied.",
    );
  }
}

async function normalizeKnownLegacySchema(prisma, tableNames) {
  if (!tableNames.has("GuildConfig")) {
    console.info("[Migration] Adding compatible legacy table GuildConfig.");
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "GuildConfig" (
        "guildId" TEXT NOT NULL PRIMARY KEY,
        "adminRoleIds" TEXT NOT NULL DEFAULT '[]',
        "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "atualizadoEm" DATETIME NOT NULL
      )
    `);
    tableNames.add("GuildConfig");
  }

  const jogadorColumns = await prisma.$queryRawUnsafe('PRAGMA table_info("Jogador")');
  const jogadorId = jogadorColumns.find(row => row.name === "id");
  const jogadorGuildId = jogadorColumns.find(row => row.name === "guildId");
  if (Number(jogadorId?.pk) === 1 && Number(jogadorGuildId?.pk) === 0) {
    console.info("[Migration] Upgrading legacy Jogador primary key.");
    await prisma.$transaction(async transaction => {
      await transaction.$executeRawUnsafe(`
        CREATE TABLE "new_Jogador" (
          "id" TEXT NOT NULL,
          "guildId" TEXT NOT NULL,
          "nome" TEXT NOT NULL,
          "vitorias" INTEGER NOT NULL DEFAULT 0,
          "derrotas" INTEGER NOT NULL DEFAULT 0,
          "confrontos" INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY ("id", "guildId")
        )
      `);
      await transaction.$executeRawUnsafe(`
        INSERT INTO "new_Jogador" ("id", "guildId", "nome", "vitorias", "derrotas", "confrontos")
        SELECT "id", "guildId", "nome", "vitorias", "derrotas", "confrontos" FROM "Jogador"
      `);
      await transaction.$executeRawUnsafe('DROP TABLE "Jogador"');
      await transaction.$executeRawUnsafe('ALTER TABLE "new_Jogador" RENAME TO "Jogador"');
    });
  }

  await addKnownLegacyColumns(prisma);
}

async function addKnownLegacyColumns(prisma) {
  for (const [tableName, columns] of Object.entries(LEGACY_ADDITIVE_COLUMNS)) {
    const rows = await prisma.$queryRawUnsafe(`PRAGMA table_info("${tableName}")`);
    const existingColumns = new Set(rows.map(row => row.name));

    for (const [columnName, columnType] of Object.entries(columns)) {
      if (existingColumns.has(columnName)) continue;
      console.info(`[Migration] Adding compatible legacy column ${tableName}.${columnName}.`);
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "${tableName}" ADD COLUMN "${columnName}" ${columnType}`,
      );
    }
  }
}

async function getDatabasePath(prisma) {
  const rows = await prisma.$queryRawUnsafe("PRAGMA database_list");
  return rows.find(row => row.name === "main")?.file || null;
}

async function backupDatabase(prisma, databasePath) {
  if (!databasePath || !existsSync(databasePath)) return;

  const backupDirectory = process.env.DATABASE_BACKUP_DIR || join(process.cwd(), "backups");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = join(backupDirectory, `pre-admin-panel-foundation-${timestamp}.db`);

  mkdirSync(backupDirectory, { recursive: true });
  const escapedPath = backupPath.replace(/'/g, "''");
  await prisma.$executeRawUnsafe(`VACUUM INTO '${escapedPath}'`);
  console.info(`[Migration] Backup created at ${backupPath}.`);
}

async function prepareLegacyDatabase() {
  let prisma = new PrismaClient({ log: [] });
  let shouldRegisterBaseline = false;

  try {
    const tableNames = await getTableNames(prisma);
    const hasMigrationHistory = tableNames.has("_prisma_migrations");
    if (hasMigrationHistory) return;

    const hasLegacyDatabase = tableNames.has("Pool");
    const hasOtherApplicationTables = [...tableNames].some(name => name !== "Pool");

    if (!hasLegacyDatabase && hasOtherApplicationTables) {
      throw new Error(
        "Unmanaged SQLite database contains tables but no Pool table. Migration was stopped.",
      );
    }
    if (!hasLegacyDatabase) return;

    const databasePath = await getDatabasePath(prisma);
    await backupDatabase(prisma, databasePath);
    await normalizeKnownLegacySchema(prisma, tableNames);
    await validateLegacyBaseline(prisma, tableNames);
    shouldRegisterBaseline = true;
  } finally {
    await prisma.$disconnect();
  }

  if (!shouldRegisterBaseline) return;
  console.info("[Migration] Compatible legacy database detected; registering baseline.");
  runPrisma(["migrate", "resolve", "--applied", BASELINE_MIGRATION]);
}

async function main() {
  await prepareLegacyDatabase();
  runPrisma(["migrate", "deploy"]);
}

main().catch(error => {
  console.error(`[Migration] ${error instanceof Error ? error.message : "Unexpected migration failure."}`);
  process.exit(1);
});
