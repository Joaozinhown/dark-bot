import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSetAssignments,
  drawStartingTeam,
  getPickSetNumber,
  getKillerTeamForSet,
  getVetoAction,
} from './veto-rules';
import { POOL_PRESETS } from '../data/pool-presets';

test('draws each team from opposite halves of the random range', () => {
  assert.equal(drawStartingTeam(() => 0), 'A');
  assert.equal(drawStartingTeam(() => 0.999), 'B');
});

test('alternates the killer team from the drawn starter', () => {
  assert.equal(getKillerTeamForSet('A', 1), 'A');
  assert.equal(getKillerTeamForSet('A', 2), 'B');
  assert.equal(getKillerTeamForSet('A', 3), 'A');
  assert.equal(getKillerTeamForSet('B', 1), 'B');
});

test('classifies every MD3 veto step and marks tiebreak bans', () => {
  assert.deepEqual(
    Array.from({ length: 8 }, (_, stepIndex) => getVetoAction('MD3', stepIndex)),
    [
      { action: 'ban', isTiebreak: false },
      { action: 'ban', isTiebreak: false },
      { action: 'ban', isTiebreak: false },
      { action: 'ban', isTiebreak: false },
      { action: 'pick', isTiebreak: false },
      { action: 'pick', isTiebreak: false },
      { action: 'ban', isTiebreak: true },
      { action: 'ban', isTiebreak: true },
    ],
  );
});

test('classifies every MD5 veto step and assigns set numbers only to picks', () => {
  const actions = Array.from({ length: 10 }, (_, stepIndex) => getVetoAction('MD5', stepIndex));
  assert.deepEqual(actions, [
    { action: 'ban', isTiebreak: false },
    { action: 'ban', isTiebreak: false },
    { action: 'pick', isTiebreak: false },
    { action: 'pick', isTiebreak: false },
    { action: 'ban', isTiebreak: false },
    { action: 'ban', isTiebreak: false },
    { action: 'pick', isTiebreak: false },
    { action: 'pick', isTiebreak: false },
    { action: 'ban', isTiebreak: true },
    { action: 'ban', isTiebreak: true },
  ]);
  assert.equal(getPickSetNumber('ban', 0), null);
  assert.equal(getPickSetNumber('pick', 0), 1);
  assert.equal(getPickSetNumber('pick', 3), 4);
});

test('pairs remaining killers with preset maps in pool order', () => {
  assert.deepEqual(
    createSetAssignments(
      ['Map 1', 'Map 2', 'Map 3'],
      ['Killer 1', 'Killer 2', 'Killer 3'],
      'B',
    ),
    [
      { numero: 1, mapa: 'Map 1', killer: 'Killer 1', killerTime: 'B' },
      { numero: 2, mapa: 'Map 2', killer: 'Killer 2', killerTime: 'A' },
      { numero: 3, mapa: 'Map 3', killer: 'Killer 3', killerTime: 'B' },
    ],
  );
});

test('rejects incomplete killer selections', () => {
  assert.throws(
    () => createSetAssignments(['Map 1', 'Map 2'], ['Killer 1'], 'A'),
    /um killer por mapa/i,
  );
});

test('each preset pool requires exactly six killer bans', () => {
  for (const pool of POOL_PRESETS) {
    assert.equal(pool.killers.length - pool.mapas.length, 6);
  }
});

test('exposes the three tournament pools in order', () => {
  assert.deepEqual(
    POOL_PRESETS.map(pool => [pool.nome, pool.formato]),
    [
      ['Queens Trials 1', 'MD3'],
      ['Queens Trials 2', 'MD5'],
      ['Queens Trials 3', 'MD5'],
    ],
  );
});
