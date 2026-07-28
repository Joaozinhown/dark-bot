-- Baseline of the database schema that existed before the admin panel.
CREATE TABLE "Pool" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guildId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "formato" TEXT NOT NULL,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "GuildConfig" (
    "guildId" TEXT NOT NULL PRIMARY KEY,
    "adminRoleIds" TEXT NOT NULL DEFAULT '[]',
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL
);

CREATE TABLE "PoolMapa" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "poolId" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    CONSTRAINT "PoolMapa_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "Pool" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "PoolKiller" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "poolId" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    CONSTRAINT "PoolKiller_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "Pool" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Confronto" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guildId" TEXT NOT NULL,
    "poolId" INTEGER NOT NULL,
    "formato" TEXT NOT NULL,
    "timeARoleId" TEXT NOT NULL,
    "timeBRoleId" TEXT NOT NULL,
    "timeAVitorias" INTEGER NOT NULL DEFAULT 0,
    "timeBVitorias" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'aguardando',
    "currentSet" INTEGER NOT NULL DEFAULT 1,
    "channelId" TEXT,
    "vozTimeAId" TEXT,
    "vozTimeBId" TEXT,
    "vencedor" TEXT,
    "primeiroKiller" TEXT,
    "encerradoEm" DATETIME,
    "motivoEncerramento" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Confronto_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "Pool" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "Set" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "confrontoId" INTEGER NOT NULL,
    "numero" INTEGER NOT NULL,
    "vencedorTime" TEXT,
    "mapaUsado" TEXT,
    "killerUsado" TEXT,
    "killerTime" TEXT,
    "jogadoEm" DATETIME,
    CONSTRAINT "Set_confrontoId_fkey" FOREIGN KEY ("confrontoId") REFERENCES "Confronto" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "VetoState" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "confrontoId" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "set" INTEGER NOT NULL,
    "vezDe" TEXT NOT NULL,
    "mapasRestantes" TEXT NOT NULL,
    "killersRestantes" TEXT NOT NULL,
    "mapaEscolhido" TEXT,
    "killerEscolhido" TEXT,
    "messageId" TEXT,
    CONSTRAINT "VetoState_confrontoId_fkey" FOREIGN KEY ("confrontoId") REFERENCES "Confronto" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "Jogador" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "vitorias" INTEGER NOT NULL DEFAULT 0,
    "derrotas" INTEGER NOT NULL DEFAULT 0,
    "confrontos" INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY ("id", "guildId")
);

CREATE UNIQUE INDEX "Pool_id_guildId_key" ON "Pool"("id", "guildId");
CREATE UNIQUE INDEX "VetoState_confrontoId_key" ON "VetoState"("confrontoId");
