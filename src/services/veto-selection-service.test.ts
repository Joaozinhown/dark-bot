import assert from 'node:assert/strict';
import test from 'node:test';
import {
  VetoSelectionServiceError,
  createVetoSelectionService,
  type CommitVetoSelectionInput,
  type VetoSelectionInput,
  type VetoSelectionStore,
} from './veto-selection-service';

const BASE_INPUT: VetoSelectionInput = {
  guildId: '100000000000000001',
  channelId: '100000000000000002',
  confrontationId: 42,
  format: 'MD3',
  stepIndex: 4,
  turn: 'A',
  messageId: '100000000000000003',
  killersSerialized: '["Artist","Nurse","Spirit"]',
  pickedKillersSerialized: '[]',
  killer: 'Nurse',
  actor: {
    userId: '100000000000000004',
    username: 'player.one',
    displayName: 'Player One',
    teamSide: 'A',
    teamRoleId: '100000000000000005',
    teamRoleName: 'Team Alpha',
  },
};

function createStore(commitResult = true) {
  const commits: CommitVetoSelectionInput[] = [];
  const store: VetoSelectionStore = {
    async commit(input) {
      commits.push(structuredClone(input));
      return commitResult;
    },
  };
  return { store, commits };
}

test('commits a pick and its actor audit payload atomically', async () => {
  const { store, commits } = createStore();
  const service = createVetoSelectionService(store);

  const result = await service.select(BASE_INPUT);

  assert.equal(result.action, 'pick');
  assert.equal(result.setNumber, 1);
  assert.deepEqual(result.remainingKillers, ['Artist', 'Spirit']);
  assert.deepEqual(result.pickedKillers, ['Nurse']);
  assert.equal(result.nextTurn, 'B');
  assert.deepEqual(commits, [{
    expected: {
      confrontationId: 42,
      stepIndex: 4,
      turn: 'A',
      messageId: '100000000000000003',
      killersSerialized: '["Artist","Nurse","Spirit"]',
      pickedKillersSerialized: '[]',
    },
    next: {
      stepIndex: 5,
      turn: 'B',
      killersSerialized: '["Artist","Spirit"]',
      pickedKillersSerialized: '["Nurse"]',
    },
    audit: {
      guildId: '100000000000000001',
      actorUserId: '100000000000000004',
      action: 'veto.pick',
      entityType: 'confrontation',
      entityId: '42',
      details: {
        actorDisplayName: 'Player One',
        actorUsername: 'player.one',
        channelId: '100000000000000002',
        killer: 'Nurse',
        messageId: '100000000000000003',
        setNumber: 1,
        teamRoleId: '100000000000000005',
        teamRoleName: 'Team Alpha',
        teamSide: 'A',
        vetoStep: 5,
      },
    },
  }]);
});

test('records a ban without assigning it to a set', async () => {
  const { store, commits } = createStore();
  const service = createVetoSelectionService(store);

  const result = await service.select({ ...BASE_INPUT, stepIndex: 0 });

  assert.equal(result.action, 'ban');
  assert.equal(result.setNumber, null);
  assert.equal(commits[0]!.audit.action, 'veto.ban');
  assert.equal(commits[0]!.audit.details.setNumber, null);
  assert.deepEqual(result.pickedKillers, []);
});

test('rejects unavailable killers and the wrong team without writing audit', async () => {
  const { store, commits } = createStore();
  const service = createVetoSelectionService(store);

  await assert.rejects(
    service.select({ ...BASE_INPUT, killer: 'Clown' }),
    (error: unknown) => error instanceof VetoSelectionServiceError
      && error.code === 'KILLER_UNAVAILABLE',
  );
  await assert.rejects(
    service.select({ ...BASE_INPUT, actor: { ...BASE_INPUT.actor, teamSide: 'B' } }),
    (error: unknown) => error instanceof VetoSelectionServiceError
      && error.code === 'WRONG_TEAM',
  );
  assert.deepEqual(commits, []);
});

test('reports a stale selection when the conditional transaction loses the race', async () => {
  const { store, commits } = createStore(false);
  const service = createVetoSelectionService(store);

  await assert.rejects(
    service.select(BASE_INPUT),
    (error: unknown) => error instanceof VetoSelectionServiceError
      && error.code === 'STALE_STATE',
  );
  assert.equal(commits.length, 1);
});

test('rejects malformed serialized state before calling the store', async () => {
  const { store, commits } = createStore();
  const service = createVetoSelectionService(store);

  await assert.rejects(
    service.select({ ...BASE_INPUT, killersSerialized: '{}' }),
    (error: unknown) => error instanceof VetoSelectionServiceError
      && error.code === 'INVALID_STATE',
  );
  assert.deepEqual(commits, []);
});
