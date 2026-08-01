import { randomUUID } from 'node:crypto';
import type { CustomCommand, CustomCommandVersion, Prisma } from '@prisma/client';
import prisma from '../database/client';
import {
  containsScript,
  parseCustomCommandDefinition,
  type CustomCommandDefinition,
} from './definition';
import { createNativeFactoryDefinition } from './compiler';

export const ARCHIVED_COMMAND_STATUSES = ['archived', 'factory_restored'] as const;
const MAX_GUILD_CHAT_INPUT_COMMANDS = 100;

export class CustomCommandError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly statusCode = 400,
  ) {
    super(message);
    this.name = 'CustomCommandError';
  }
}

export interface NativeCommandSource {
  readonly payload: Record<string, unknown>;
  readonly requireBotAdmin: boolean;
}

export interface CommandVersionView {
  id: number;
  version: number;
  definition: CustomCommandDefinition;
  publishedById: string;
  criadoEm: Date;
}

export interface CommandCatalogItem {
  id: number | null;
  stableKey: string;
  sourceType: 'native' | 'custom';
  factoryCommandName: string | null;
  name: string;
  description: string;
  definition: CustomCommandDefinition;
  enabled: boolean;
  status: string;
  publishedVersionId: number | null;
  discordCommandId: string | null;
  hasUnpublishedChanges: boolean;
  versions: CommandVersionView[];
  criadoEm: Date | null;
  atualizadoEm: Date | null;
}

export interface CommandRegistrationState {
  command: CustomCommand;
  version: CustomCommandVersion | null;
  definition: CustomCommandDefinition | null;
}

export interface SaveDraftInput {
  guildId: string;
  actorUserId: string;
  commandId?: number | null;
  sourceType: 'native' | 'custom';
  factoryCommandName?: string | null;
  definition: unknown;
  nativeCommands: readonly NativeCommandSource[];
}

type CommandWithVersions = Prisma.CustomCommandGetPayload<{ include: { versions: true } }>;

function parseStoredDefinition(value: string): CustomCommandDefinition {
  try {
    return parseCustomCommandDefinition(JSON.parse(value));
  } catch (error: unknown) {
    throw new CustomCommandError(
      'INVALID_STORED_DEFINITION',
      `Definicao armazenada invalida: ${error instanceof Error ? error.message : String(error)}`,
      500,
    );
  }
}

function parseVersion(version: CustomCommandVersion): CommandVersionView {
  return {
    id: version.id,
    version: version.version,
    definition: parseStoredDefinition(version.definition),
    publishedById: version.publishedById,
    criadoEm: version.criadoEm,
  };
}

function rowToCatalog(row: CommandWithVersions): CommandCatalogItem {
  const definition = parseStoredDefinition(row.draftDefinition);
  const published = row.publishedVersionId === null
    ? null
    : row.versions.find(version => version.id === row.publishedVersionId) ?? null;
  return {
    id: row.id,
    stableKey: row.stableKey,
    sourceType: row.sourceType === 'native' ? 'native' : 'custom',
    factoryCommandName: row.factoryCommandName,
    name: definition.command.name.ptBR,
    description: definition.command.description.ptBR,
    definition,
    enabled: row.enabled,
    status: row.status,
    publishedVersionId: row.publishedVersionId,
    discordCommandId: row.discordCommandId,
    hasUnpublishedChanges: published?.definition !== row.draftDefinition,
    versions: row.versions.map(parseVersion),
    criadoEm: row.criadoEm,
    atualizadoEm: row.atualizadoEm,
  };
}

function nativeFactoryItem(source: NativeCommandSource): CommandCatalogItem {
  const definition = createNativeFactoryDefinition(source.payload, source.requireBotAdmin);
  const name = definition.command.name.ptBR;
  return {
    id: null,
    stableKey: `native:${name}`,
    sourceType: 'native',
    factoryCommandName: name,
    name,
    description: definition.command.description.ptBR,
    definition,
    enabled: true,
    status: 'factory',
    publishedVersionId: null,
    discordCommandId: null,
    hasUnpublishedChanges: false,
    versions: [],
    criadoEm: null,
    atualizadoEm: null,
  };
}

function activeWhere(guildId: string): Prisma.CustomCommandWhereInput {
  return {
    guildId,
    status: { notIn: [...ARCHIVED_COMMAND_STATUSES] },
  };
}

async function requireCommand(guildId: string, commandId: number) {
  const command = await prisma.customCommand.findFirst({
    where: { id: commandId, guildId },
    include: { versions: { orderBy: { version: 'desc' } } },
  });
  if (!command) throw new CustomCommandError('COMMAND_NOT_FOUND', 'Comando nao encontrado.', 404);
  return command;
}

function commandNames(definition: CustomCommandDefinition): string[] {
  return [definition.command.name.ptBR, definition.command.name.enUS].map(name => name.toLowerCase());
}

async function validateNameAvailability(
  guildId: string,
  definition: CustomCommandDefinition,
  stableKey: string,
  nativeCommands: readonly NativeCommandSource[],
): Promise<void> {
  const rows = await prisma.customCommand.findMany({ where: activeWhere(guildId) });
  const overriddenFactories = new Set(
    rows.filter(row => row.sourceType === 'native').map(row => row.factoryCommandName),
  );
  const reserved = new Map<string, string>();
  for (const source of nativeCommands) {
    const name = String(source.payload.name ?? '');
    if (!name || overriddenFactories.has(name) || stableKey === `native:${name}`) continue;
    reserved.set(name.toLowerCase(), `/${name}`);
  }
  for (const row of rows) {
    if (row.stableKey === stableKey) continue;
    const existing = parseStoredDefinition(row.draftDefinition);
    for (const name of commandNames(existing)) reserved.set(name, `/${existing.command.name.ptBR}`);
  }
  for (const name of commandNames(definition)) {
    const conflict = reserved.get(name);
    if (conflict) {
      throw new CustomCommandError('COMMAND_NAME_CONFLICT', `Nome ja usado pelo comando ${conflict}.`, 409);
    }
  }
}

export const customCommandService = {
  async listCatalog(
    guildId: string,
    nativeCommands: readonly NativeCommandSource[],
  ): Promise<CommandCatalogItem[]> {
    const rows = await prisma.customCommand.findMany({
      where: activeWhere(guildId),
      include: { versions: { orderBy: { version: 'desc' }, take: 20 } },
      orderBy: { atualizadoEm: 'desc' },
    });
    const overrides = new Map<string | null, CommandWithVersions>(
      rows.filter(row => row.sourceType === 'native').map(row => [row.factoryCommandName, row]),
    );
    const native = nativeCommands.map(source => {
      const name = String(source.payload.name ?? '');
      const override = overrides.get(name);
      return override ? rowToCatalog(override) : nativeFactoryItem(source);
    });
    const custom = rows.filter(row => row.sourceType !== 'native').map(row => rowToCatalog(row));
    return [...native, ...custom].sort((left, right) => left.name.localeCompare(right.name));
  },

  async get(guildId: string, commandId: number): Promise<CommandCatalogItem> {
    return rowToCatalog(await requireCommand(guildId, commandId));
  },

  async saveDraft(input: SaveDraftInput): Promise<CommandCatalogItem> {
    const definition = parseCustomCommandDefinition(input.definition);
    if (input.sourceType === 'native') {
      const factoryName = input.factoryCommandName ?? definition.execution.factoryCommandName;
      if (!factoryName || !input.nativeCommands.some(source => source.payload.name === factoryName)) {
        throw new CustomCommandError('FACTORY_COMMAND_NOT_FOUND', 'Comando nativo de fabrica nao encontrado.', 404);
      }
      definition.execution.factoryCommandName = factoryName;
    } else if (definition.execution.mode === 'native') {
      throw new CustomCommandError('CUSTOM_NATIVE_HANDLER', 'Comando personalizado nao pode usar handler nativo.');
    }

    const existing = input.commandId
      ? await requireCommand(input.guildId, input.commandId)
      : null;
    if (existing && existing.sourceType !== input.sourceType) {
      throw new CustomCommandError('SOURCE_TYPE_IMMUTABLE', 'Tipo do comando nao pode ser alterado.');
    }
    const factoryName = input.sourceType === 'native'
      ? input.factoryCommandName ?? definition.execution.factoryCommandName ?? null
      : null;
    const stableKey = existing?.stableKey
      ?? (factoryName ? `native:${factoryName}` : `custom:${randomUUID()}`);
    await validateNameAvailability(input.guildId, definition, stableKey, input.nativeCommands);
    const serialized = JSON.stringify(definition);
    const data = {
      guildId: input.guildId,
      stableKey,
      sourceType: input.sourceType,
      factoryCommandName: factoryName,
      name: definition.command.name.ptBR,
      description: definition.command.description.ptBR,
      draftDefinition: serialized,
      updatedByUserId: input.actorUserId,
      status: existing?.publishedVersionId ? 'published' : 'draft',
    };
    const row = existing
      ? await prisma.customCommand.update({
        where: { id: existing.id },
        data,
        include: { versions: { orderBy: { version: 'desc' }, take: 20 } },
      })
      : await prisma.customCommand.create({
        data: { ...data, enabled: true, createdByUserId: input.actorUserId },
        include: { versions: true },
      });
    return rowToCatalog(row);
  },

  async publish(guildId: string, commandId: number, actorUserId: string): Promise<CommandCatalogItem> {
    const command = await requireCommand(guildId, commandId);
    const definition = parseStoredDefinition(command.draftDefinition);
    const activePublishedCount = await prisma.customCommand.count({
      where: { guildId, enabled: true, publishedVersionId: { not: null }, status: { notIn: [...ARCHIVED_COMMAND_STATUSES] } },
    });
    const isAlreadyPublished = command.publishedVersionId !== null;
    if (!isAlreadyPublished && activePublishedCount >= MAX_GUILD_CHAT_INPUT_COMMANDS) {
      throw new CustomCommandError('COMMAND_LIMIT', 'Servidor atingiu limite de comandos slash publicados.', 409);
    }
    const latestVersion = command.versions.reduce((maximum, version) => Math.max(maximum, version.version), 0);
    const updated = await prisma.$transaction(async transaction => {
      const version = await transaction.customCommandVersion.create({
        data: {
          commandId: command.id,
          version: latestVersion + 1,
          definition: JSON.stringify(definition),
          publishedById: actorUserId,
        },
      });
      return transaction.customCommand.update({
        where: { id: command.id },
        data: {
          publishedVersionId: version.id,
          status: 'published',
          enabled: true,
          updatedByUserId: actorUserId,
        },
        include: { versions: { orderBy: { version: 'desc' }, take: 20 } },
      });
    });
    return rowToCatalog(updated);
  },

  async rollback(
    guildId: string,
    commandId: number,
    versionId: number,
    actorUserId: string,
  ): Promise<CommandCatalogItem> {
    const command = await requireCommand(guildId, commandId);
    const version = command.versions.find(item => item.id === versionId);
    if (!version) throw new CustomCommandError('VERSION_NOT_FOUND', 'Versao nao encontrada.', 404);
    await prisma.customCommand.update({
      where: { id: command.id },
      data: { draftDefinition: version.definition, updatedByUserId: actorUserId },
    });
    return this.publish(guildId, commandId, actorUserId);
  },

  async setEnabled(
    guildId: string,
    commandId: number,
    enabled: boolean,
    actorUserId: string,
  ): Promise<CommandCatalogItem> {
    await requireCommand(guildId, commandId);
    const updated = await prisma.customCommand.update({
      where: { id: commandId },
      data: { enabled, updatedByUserId: actorUserId },
      include: { versions: { orderBy: { version: 'desc' }, take: 20 } },
    });
    return rowToCatalog(updated);
  },

  async archive(
    guildId: string,
    commandId: number,
    actorUserId: string,
  ): Promise<{ id: number; status: string }> {
    const command = await requireCommand(guildId, commandId);
    const status = command.sourceType === 'native' ? 'factory_restored' : 'archived';
    await prisma.customCommand.update({
      where: { id: command.id },
      data: {
        status,
        enabled: false,
        publishedVersionId: null,
        discordCommandId: null,
        updatedByUserId: actorUserId,
      },
    });
    return { id: command.id, status };
  },

  async clone(
    sourceGuildId: string,
    commandId: number,
    targetGuildId: string,
    actorUserId: string,
    name: { ptBR: string; enUS: string },
    nativeCommands: readonly NativeCommandSource[],
  ): Promise<CommandCatalogItem> {
    const source = await requireCommand(sourceGuildId, commandId);
    const definition = parseStoredDefinition(source.draftDefinition);
    definition.execution = { mode: 'workflow' };
    definition.command.name = name;
    return this.saveDraft({
      guildId: targetGuildId,
      actorUserId,
      sourceType: 'custom',
      definition,
      nativeCommands,
    });
  },

  async markSyncError(commandId: number): Promise<void> {
    await prisma.customCommand.update({ where: { id: commandId }, data: { status: 'sync_error' } });
  },

  async setDiscordCommandId(commandId: number, discordCommandId: string | null): Promise<void> {
    await prisma.customCommand.update({ where: { id: commandId }, data: { discordCommandId } });
  },

  async listPublished(guildId: string): Promise<Array<{
    command: CustomCommand;
    version: CustomCommandVersion;
    definition: CustomCommandDefinition;
  }>> {
    const rows = await prisma.customCommand.findMany({
      where: {
        guildId,
        enabled: true,
        publishedVersionId: { not: null },
        status: { notIn: [...ARCHIVED_COMMAND_STATUSES] },
      },
      include: { versions: true },
    });
    return rows.flatMap(command => {
      const version = command.versions.find(item => item.id === command.publishedVersionId);
      return version ? [{ command, version, definition: parseStoredDefinition(version.definition) }] : [];
    });
  },

  async listRegistrationState(guildId: string): Promise<CommandRegistrationState[]> {
    const rows = await prisma.customCommand.findMany({
      where: activeWhere(guildId),
      include: { versions: true },
    });
    return rows.map(command => {
      const version = command.publishedVersionId === null
        ? null
        : command.versions.find(item => item.id === command.publishedVersionId) ?? null;
      return {
        command,
        version,
        definition: version ? parseStoredDefinition(version.definition) : null,
      };
    });
  },

  async findPublishedByDiscordId(guildId: string, discordCommandId: string) {
    const command = await prisma.customCommand.findFirst({
      where: {
        guildId,
        discordCommandId,
        enabled: true,
        publishedVersionId: { not: null },
        status: { notIn: [...ARCHIVED_COMMAND_STATUSES] },
      },
      include: { versions: true },
    });
    if (!command) return null;
    const version = command.versions.find(item => item.id === command.publishedVersionId);
    return version ? { command, version, definition: parseStoredDefinition(version.definition) } : null;
  },

  containsScript,
};
