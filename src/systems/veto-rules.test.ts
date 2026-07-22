import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSetAssignments,
  drawStartingTeam,
  getKillerTeamForSet,
} from './veto-rules';
import { POOL_PRESETS } from '../data/pool-presets';
import { buildConfrontoChannelName } from '../utils/channels';

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

test('builds confrontation channel names from team roles only', () => {
  assert.equal(
    buildConfrontoChannelName('Time 1', 'Time 2'),
    'time-1-vs-time-2',
  );
});
