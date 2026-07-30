import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ConfrontationServiceError,
  createConfrontationService,
  type ConfrontationRecord,
  type ConfrontationStore,
  type PoolRecord,
} from './confrontation-service';

const pool: PoolRecord = {
  id: 4,
  guildId: 'guild-1',
  formato: 'MD3',
  ativa: true,
  mapas: ['Map 1', 'Map 2', 'Map 3'],
  killers: ['K1', 'K2', 'K3', 'K4'],
};

const confrontation: ConfrontationRecord = {
  id: 9,
  guildId: 'guild-1',
  poolId: 4,
  formato: 'MD3',
  timeARoleId: 'role-a',
  timeBRoleId: 'role-b',
  timeAVitorias: 0,
  timeBVitorias: 0,
  status: 'veto',
  currentSet: 1,
  channelId: 'channel-1',
  vozTimeAId: null,
  vozTimeBId: null,
  vencedor: null,
  primeiroKiller: 'A',
  encerradoEm: null,
  motivoEncerramento: null,
  criadoEm: new Date('2026-07-28T12:00:00.000Z'),
};

function createStore(overrides: Partial<ConfrontationStore> = {}): ConfrontationStore {
  return {
    findPool: async () => pool,
    create: async input => ({ ...confrontation, ...input }),
    findById: async () => confrontation,
    recordResult: async (_id, _guildId, winner) => ({
      ...confrontation,
      vencedor: winner,
      timeAVitorias: winner === 'A' ? confrontation.timeAVitorias + 1 : confrontation.timeAVitorias,
      timeBVitorias: winner === 'B' ? confrontation.timeBVitorias + 1 : confrontation.timeBVitorias,
      status: 'resultado',
    }),
    close: async (_id, _guildId, reason, closedAt) => ({
      ...confrontation,
      status: 'encerrado',
      motivoEncerramento: reason,
      encerradoEm: closedAt,
    }),
    listActive: async () => [confrontation],
    ...overrides,
  };
}

test('creates a confrontation in the invoking channel with a deterministic draw', async () => {
  let receivedInput: unknown;
  const service = createConfrontationService(createStore({
    create: async input => {
      receivedInput = input;
      return { ...confrontation, ...input };
    },
  }), () => 0.99);

  const result = await service.create({
    guildId: 'guild-1',
    poolId: 4,
    timeARoleId: 'role-a',
    timeBRoleId: 'role-b',
    channelId: 'channel-1',
  });

  assert.equal(result.primeiroKiller, 'B');
  assert.deepEqual(receivedInput, {
    guildId: 'guild-1',
    poolId: 4,
    formato: 'MD3',
    timeARoleId: 'role-a',
    timeBRoleId: 'role-b',
    primeiroKiller: 'B',
    status: 'veto',
    channelId: 'channel-1',
  });
});

test('acknowledges the Discord interaction before persisting a confrontation', async () => {
  const events: string[] = [];
  const service = createConfrontationService(createStore({
    create: async input => {
      events.push('persist');
      return { ...confrontation, ...input };
    },
  }));

  await service.create(
    {
      guildId: 'guild-1', poolId: 4, timeARoleId: 'a', timeBRoleId: 'b', channelId: 'c',
    },
    async () => { events.push('defer'); },
  );

  assert.deepEqual(events, ['defer', 'persist']);
});

test('rejects invalid pools and duplicate teams before creating', async () => {
  const missingPool = createConfrontationService(createStore({ findPool: async () => null }));
  await assert.rejects(
    missingPool.create({
      guildId: 'guild-1', poolId: 4, timeARoleId: 'a', timeBRoleId: 'b', channelId: 'c',
    }),
    (error: unknown) => error instanceof ConfrontationServiceError && error.code === 'POOL_NOT_FOUND',
  );

  const service = createConfrontationService(createStore());
  await assert.rejects(
    service.create({
      guildId: 'guild-1', poolId: 4, timeARoleId: 'same', timeBRoleId: 'same', channelId: 'c',
    }),
    (error: unknown) => error instanceof ConfrontationServiceError && error.code === 'SAME_TEAM',
  );
});

test('validates preset map and killer counts', async () => {
  const invalidMaps = createConfrontationService(createStore({
    findPool: async () => ({ ...pool, mapas: ['Map 1'] }),
  }));
  await assert.rejects(
    invalidMaps.create({
      guildId: 'guild-1', poolId: 4, timeARoleId: 'a', timeBRoleId: 'b', channelId: 'c',
    }),
    (error: unknown) => error instanceof ConfrontationServiceError && error.code === 'INVALID_MAP_COUNT',
  );

  const invalidKillers = createConfrontationService(createStore({
    findPool: async () => ({ ...pool, killers: ['K1', 'K2', 'K3'] }),
  }));
  await assert.rejects(
    invalidKillers.create({
      guildId: 'guild-1', poolId: 4, timeARoleId: 'a', timeBRoleId: 'b', channelId: 'c',
    }),
    (error: unknown) => error instanceof ConfrontationServiceError && error.code === 'INSUFFICIENT_KILLERS',
  );
});

test('records a participating winner and increments only that team', async () => {
  let resultInput: unknown;
  const service = createConfrontationService(createStore({
    recordResult: async (id, guildId, winner) => {
      resultInput = { id, guildId, winner };
      return { ...confrontation, vencedor: winner, status: 'resultado', timeBVitorias: 1 };
    },
  }));

  const result = await service.recordResult(9, 'role-b', 'guild-1');

  assert.equal(result.winner, 'B');
  assert.deepEqual(resultInput, { id: 9, guildId: 'guild-1', winner: 'B' });
});

test('rejects results for unknown, closed, or non-participating confrontations', async () => {
  const missing = createConfrontationService(createStore({ findById: async () => null }));
  await assert.rejects(missing.recordResult(99, 'role-a', 'guild-1'), { code: 'NOT_FOUND' });

  const closed = createConfrontationService(createStore({
    findById: async () => ({ ...confrontation, status: 'encerrado' }),
  }));
  await assert.rejects(closed.recordResult(9, 'role-a', 'guild-1'), { code: 'ALREADY_CLOSED' });

  const outsider = createConfrontationService(createStore());
  await assert.rejects(outsider.recordResult(9, 'other-role', 'guild-1'), { code: 'INVALID_WINNER' });
});

test('closes an active confrontation and lists only guild active records', async () => {
  let closeInput: unknown;
  let listedGuild: string | undefined;
  const service = createConfrontationService(createStore({
    close: async (id, guildId, reason, closedAt) => {
      closeInput = { id, guildId, reason, closedAt };
      return { ...confrontation, status: 'encerrado', motivoEncerramento: reason, encerradoEm: closedAt };
    },
    listActive: async guildId => {
      listedGuild = guildId;
      return [confrontation];
    },
  }));

  const closed = await service.close(9, 'fim', 'guild-1');
  const listed = await service.listActive('guild-1');

  assert.equal(closed.status, 'encerrado');
  assert.equal((closeInput as { reason: string }).reason, 'fim');
  assert.equal((closeInput as { closedAt: Date }).closedAt instanceof Date, true);
  assert.equal(listedGuild, 'guild-1');
  assert.deepEqual(listed, [confrontation]);
});

test('reports a concurrent close instead of overwriting it', async () => {
  const service = createConfrontationService(createStore({ close: async () => null }));

  await assert.rejects(
    service.close(9, 'fim', 'guild-1'),
    (error: unknown) => error instanceof ConfrontationServiceError && error.code === 'ALREADY_CLOSED',
  );
});

test('reports a concurrent close while recording a result', async () => {
  const service = createConfrontationService(createStore({ recordResult: async () => null }));

  await assert.rejects(
    service.recordResult(9, 'role-a', 'guild-1'),
    (error: unknown) => error instanceof ConfrontationServiceError && error.code === 'ALREADY_CLOSED',
  );
});
