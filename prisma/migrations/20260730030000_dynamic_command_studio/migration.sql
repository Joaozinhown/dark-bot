ALTER TABLE "GuildConfig" ADD COLUMN "scriptRoleIds" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "GuildConfig" ADD COLUMN "scriptUserIds" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "GuildConfig" ADD COLUMN "scriptAccessById" TEXT;

PRAGMA foreign_keys=OFF;

CREATE TABLE "new_CustomCommand" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guildId" TEXT NOT NULL,
    "stableKey" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL DEFAULT 'custom',
    "factoryCommandName" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "draftDefinition" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "publishedVersionId" INTEGER,
    "discordCommandId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "updatedByUserId" TEXT NOT NULL,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL
);

INSERT INTO "new_CustomCommand" (
    "id", "guildId", "stableKey", "sourceType", "factoryCommandName",
    "name", "description", "draftDefinition", "enabled", "status",
    "publishedVersionId", "discordCommandId", "createdByUserId",
    "updatedByUserId", "criadoEm", "atualizadoEm"
)
SELECT
    "id", "guildId", 'custom:' || "id", 'custom', NULL,
    "name", "description",
    json_object(
      'schemaVersion', 1,
      'execution', json_object('mode', 'workflow'),
      'command', json_object(
        'name', json_object('ptBR', "name", 'enUS', "name"),
        'description', json_object('ptBR', "description", 'enUS', "description"),
        'options', json_array(),
        'defaultMemberPermissions', NULL,
        'nsfw', json('false')
      ),
      'permissions', json_object(
        'requireBotAdmin', json('false'),
        'allowedRoleIds', json_array(),
        'allowedUserIds', json_array(),
        'cooldownSeconds', 0
      ),
      'workflow', json_array(json_object(
        'id', 'legacy_reply_' || "id",
        'type', 'reply',
        'message', json_object(
          'content', json_object('ptBR', "responseTemplate", 'enUS', "responseTemplate"),
          'ephemeral', json('false'),
          'embeds', json_array(),
          'components', json_array()
        )
      ))
    ), "enabled", 'draft',
    NULL, NULL, "createdByUserId", "createdByUserId", "criadoEm", "atualizadoEm"
FROM "CustomCommand";

DROP TABLE "CustomCommand";
ALTER TABLE "new_CustomCommand" RENAME TO "CustomCommand";

CREATE UNIQUE INDEX "CustomCommand_guildId_stableKey_key" ON "CustomCommand"("guildId", "stableKey");
CREATE UNIQUE INDEX "CustomCommand_guildId_name_key" ON "CustomCommand"("guildId", "name");
CREATE INDEX "CustomCommand_guildId_enabled_idx" ON "CustomCommand"("guildId", "enabled");
CREATE INDEX "CustomCommand_guildId_discordCommandId_idx" ON "CustomCommand"("guildId", "discordCommandId");

CREATE TABLE IF NOT EXISTS "CustomCommandVersion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "commandId" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "definition" TEXT NOT NULL,
    "publishedById" TEXT NOT NULL,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomCommandVersion_commandId_fkey"
      FOREIGN KEY ("commandId") REFERENCES "CustomCommand" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "CustomCommandVersion_commandId_version_key" ON "CustomCommandVersion"("commandId", "version");
CREATE INDEX IF NOT EXISTS "CustomCommandVersion_commandId_criadoEm_idx" ON "CustomCommandVersion"("commandId", "criadoEm");

CREATE TABLE IF NOT EXISTS "CustomCommandInteraction" (
    "token" TEXT NOT NULL PRIMARY KEY,
    "guildId" TEXT NOT NULL,
    "commandId" INTEGER NOT NULL,
    "commandVersionId" INTEGER NOT NULL,
    "nodeId" TEXT NOT NULL,
    "contextJson" TEXT NOT NULL DEFAULT '{}',
    "allowedUserId" TEXT,
    "expiresAt" DATETIME NOT NULL,
    "consumedAt" DATETIME,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomCommandInteraction_commandId_fkey"
      FOREIGN KEY ("commandId") REFERENCES "CustomCommand" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CustomCommandInteraction_commandVersionId_fkey"
      FOREIGN KEY ("commandVersionId") REFERENCES "CustomCommandVersion" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "CustomCommandInteraction_guildId_expiresAt_idx" ON "CustomCommandInteraction"("guildId", "expiresAt");
CREATE INDEX IF NOT EXISTS "CustomCommandInteraction_commandVersionId_idx" ON "CustomCommandInteraction"("commandVersionId");

PRAGMA foreign_keys=ON;
