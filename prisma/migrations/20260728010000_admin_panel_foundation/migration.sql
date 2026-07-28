CREATE TABLE "WebSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "avatarHash" TEXT,
    "accessTokenEncrypted" TEXT NOT NULL,
    "refreshTokenEncrypted" TEXT,
    "expiresAt" DATETIME NOT NULL,
    "csrfTokenHash" TEXT NOT NULL,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL,
    "ultimoAcessoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revogadoEm" DATETIME
);

CREATE TABLE "AuditLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guildId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "details" TEXT NOT NULL DEFAULT '{}',
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "GuildCommandSetting" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guildId" TEXT NOT NULL,
    "commandName" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "allowedRoleIds" TEXT NOT NULL DEFAULT '[]',
    "updatedByUserId" TEXT NOT NULL,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL
);

CREATE TABLE "CustomCommand" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guildId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "responseTemplate" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "allowedRoleIds" TEXT NOT NULL DEFAULT '[]',
    "createdByUserId" TEXT NOT NULL,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL
);

CREATE INDEX "WebSession_userId_idx" ON "WebSession"("userId");
CREATE INDEX "WebSession_expiresAt_idx" ON "WebSession"("expiresAt");
CREATE INDEX "AuditLog_guildId_criadoEm_idx" ON "AuditLog"("guildId", "criadoEm");
CREATE INDEX "AuditLog_actorUserId_criadoEm_idx" ON "AuditLog"("actorUserId", "criadoEm");
CREATE UNIQUE INDEX "GuildCommandSetting_guildId_commandName_key" ON "GuildCommandSetting"("guildId", "commandName");
CREATE INDEX "GuildCommandSetting_guildId_enabled_idx" ON "GuildCommandSetting"("guildId", "enabled");
CREATE UNIQUE INDEX "CustomCommand_guildId_name_key" ON "CustomCommand"("guildId", "name");
CREATE INDEX "CustomCommand_guildId_enabled_idx" ON "CustomCommand"("guildId", "enabled");
