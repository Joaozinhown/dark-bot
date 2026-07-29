import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CommandSettingServiceError,
  createCommandSettingService,
  type CommandSettingRecord,
  type CommandSettingStore,
} from './command-setting-service';

const ALLOWED_COMMANDS = ['ranking', 'perfil', 'relatorios'] as const;

function createStore(initial: readonly CommandSettingRecord[] = []): {
  readonly store: CommandSettingStore;
  readonly snapshot: () => CommandSettingRecord[];
  readonly reads: Array<readonly [string, string]>;
  readonly writes: Array<CommandSettingRecord>;
} {
  let records = initial.map(record => ({ ...record }));
  const reads: Array<readonly [string, string]> = [];
  const writes: Array<CommandSettingRecord> = [];

  return {
    reads,
    writes,
    snapshot: () => records.map(record => ({ ...record })),
    store: {
      async find(guildId, commandName) {
        reads.push([guildId, commandName]);
        return records.find(
          record => record.guildId === guildId && record.commandName === commandName,
        ) ?? null;
      },
      async listByGuild(guildId) {
        return records
          .filter(record => record.guildId === guildId)
          .map(record => ({ ...record }));
      },
      async upsert(input) {
        const record = { ...input };
        writes.push(record);
        records = [
          ...records.filter(
            current => !(
              current.guildId === input.guildId
              && current.commandName === input.commandName
            ),
          ),
          record,
        ];
        return { ...record };
      },
    },
  };
}

test('treats an existing slash command as enabled when the guild has no setting', async () => {
  const { store, reads } = createStore();
  const service = createCommandSettingService(store, ALLOWED_COMMANDS);

  assert.equal(await service.isEnabled('guild-a', 'ranking'), true);
  assert.deepEqual(reads, [['guild-a', 'ranking']]);
});

test('returns the persisted state for the requested guild and command', async () => {
  const { store } = createStore([
    {
      guildId: 'guild-a',
      commandName: 'ranking',
      enabled: false,
      updatedByUserId: 'user-1',
    },
  ]);
  const service = createCommandSettingService(store, ALLOWED_COMMANDS);

  assert.equal(await service.isEnabled('guild-a', 'ranking'), false);
});

test('does not leak a command setting between guilds', async () => {
  const { store } = createStore([
    {
      guildId: 'guild-a',
      commandName: 'ranking',
      enabled: false,
      updatedByUserId: 'user-1',
    },
  ]);
  const service = createCommandSettingService(store, ALLOWED_COMMANDS);

  assert.equal(await service.isEnabled('guild-a', 'ranking'), false);
  assert.equal(await service.isEnabled('guild-b', 'ranking'), true);
});

test('lists only allowlisted commands and fills missing settings as enabled', async () => {
  const { store } = createStore([
    {
      guildId: 'guild-a',
      commandName: 'perfil',
      enabled: false,
      updatedByUserId: 'user-1',
    },
    {
      guildId: 'guild-a',
      commandName: 'removed-command',
      enabled: false,
      updatedByUserId: 'user-1',
    },
    {
      guildId: 'guild-b',
      commandName: 'ranking',
      enabled: false,
      updatedByUserId: 'user-2',
    },
  ]);
  const service = createCommandSettingService(store, ALLOWED_COMMANDS);

  assert.deepEqual(await service.list('guild-a'), [
    { commandName: 'ranking', enabled: true },
    { commandName: 'perfil', enabled: false },
    { commandName: 'relatorios', enabled: true },
  ]);
});

test('rejects a command outside the injected allowlist before reading or writing', async () => {
  const { store, reads, writes } = createStore();
  const service = createCommandSettingService(store, ALLOWED_COMMANDS);

  await assert.rejects(
    service.isEnabled('guild-a', 'novo-comando'),
    (error: unknown) => error instanceof CommandSettingServiceError
      && error.code === 'COMMAND_NOT_ALLOWED',
  );
  await assert.rejects(
    service.setEnabled({
      guildId: 'guild-a',
      commandName: 'novo-comando',
      enabled: false,
      updatedByUserId: 'user-1',
    }),
    (error: unknown) => error instanceof CommandSettingServiceError
      && error.code === 'COMMAND_NOT_ALLOWED',
  );

  assert.deepEqual(reads, []);
  assert.deepEqual(writes, []);
});

test('persists command state with guild and actor identity', async () => {
  const { store, snapshot, writes } = createStore();
  const service = createCommandSettingService(store, ALLOWED_COMMANDS);

  const result = await service.setEnabled({
    guildId: 'guild-a',
    commandName: 'relatorios',
    enabled: false,
    updatedByUserId: 'user-7',
  });

  assert.deepEqual(result, {
    guildId: 'guild-a',
    commandName: 'relatorios',
    enabled: false,
    updatedByUserId: 'user-7',
  });
  assert.deepEqual(writes, [result]);
  assert.deepEqual(snapshot(), [result]);
  assert.equal(await service.isEnabled('guild-b', 'relatorios'), true);
});
