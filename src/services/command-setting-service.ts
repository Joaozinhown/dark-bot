import prisma from '../database/client';

export interface CommandSettingRecord {
  readonly guildId: string;
  readonly commandName: string;
  readonly enabled: boolean;
  readonly updatedByUserId: string;
}

export interface CommandSettingState {
  readonly commandName: string;
  readonly enabled: boolean;
}

export interface SetCommandEnabledInput extends CommandSettingRecord {}

export interface CommandSettingStore {
  find(guildId: string, commandName: string): Promise<CommandSettingRecord | null>;
  listByGuild(guildId: string): Promise<readonly CommandSettingRecord[]>;
  upsert(input: SetCommandEnabledInput): Promise<CommandSettingRecord>;
}

export type CommandSettingServiceErrorCode = 'COMMAND_NOT_ALLOWED';

export class CommandSettingServiceError extends Error {
  constructor(
    readonly code: CommandSettingServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'CommandSettingServiceError';
  }
}

export interface CommandSettingService {
  isEnabled(guildId: string, commandName: string): Promise<boolean>;
  list(guildId: string): Promise<CommandSettingState[]>;
  setEnabled(input: SetCommandEnabledInput): Promise<CommandSettingRecord>;
}

export const prismaCommandSettingStore: CommandSettingStore = {
  find: (guildId, commandName) => prisma.guildCommandSetting.findUnique({
    where: { guildId_commandName: { guildId, commandName } },
    select: {
      guildId: true,
      commandName: true,
      enabled: true,
      updatedByUserId: true,
    },
  }),

  listByGuild: guildId => prisma.guildCommandSetting.findMany({
    where: { guildId },
    select: {
      guildId: true,
      commandName: true,
      enabled: true,
      updatedByUserId: true,
    },
  }),

  upsert: input => prisma.guildCommandSetting.upsert({
    where: {
      guildId_commandName: {
        guildId: input.guildId,
        commandName: input.commandName,
      },
    },
    create: { ...input },
    update: {
      enabled: input.enabled,
      updatedByUserId: input.updatedByUserId,
    },
    select: {
      guildId: true,
      commandName: true,
      enabled: true,
      updatedByUserId: true,
    },
  }),
};

export function createCommandSettingService(
  store: CommandSettingStore,
  allowedCommandNames: readonly string[],
): CommandSettingService {
  const commandNames = [...allowedCommandNames];
  const allowedCommands = new Set(commandNames);

  function assertCommandAllowed(commandName: string): void {
    if (!allowedCommands.has(commandName)) {
      throw new CommandSettingServiceError(
        'COMMAND_NOT_ALLOWED',
        `O comando slash \"${commandName}\" nao pertence ao catalogo permitido.`,
      );
    }
  }

  async function isEnabled(guildId: string, commandName: string): Promise<boolean> {
    assertCommandAllowed(commandName);
    const setting = await store.find(guildId, commandName);
    return setting?.enabled ?? true;
  }

  async function list(guildId: string): Promise<CommandSettingState[]> {
    const settings = await store.listByGuild(guildId);
    const settingsByCommand = new Map(
      settings
        .filter(setting => allowedCommands.has(setting.commandName))
        .map(setting => [setting.commandName, setting.enabled]),
    );

    return commandNames.map(commandName => ({
      commandName,
      enabled: settingsByCommand.get(commandName) ?? true,
    }));
  }

  async function setEnabled(
    input: SetCommandEnabledInput,
  ): Promise<CommandSettingRecord> {
    assertCommandAllowed(input.commandName);
    return store.upsert({ ...input });
  }

  return { isEnabled, list, setEnabled };
}
