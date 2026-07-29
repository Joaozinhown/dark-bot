import assert from 'node:assert/strict';
import test from 'node:test';
import { panelActionSchema } from './panel-actions';

const ROLE_ID = '123456789012345678';

test('accepts only the supported administrative action catalog', () => {
  const parsed = panelActionSchema.parse({
    type: 'confrontation.create',
    poolId: 2,
    teamARoleId: ROLE_ID,
    teamBRoleId: '223456789012345678',
    channelId: '323456789012345678',
  });

  assert.equal(parsed.type, 'confrontation.create');
  assert.throws(() => panelActionSchema.parse({ type: 'command.create', name: 'unsafe' }));
});

test('rejects malformed Discord ids, colors and unbounded text', () => {
  assert.throws(() => panelActionSchema.parse({
    type: 'team.create',
    name: 'Team',
    color: 'purple',
  }));
  assert.throws(() => panelActionSchema.parse({
    type: 'team.member-add',
    roleId: '../role',
    userId: ROLE_ID,
  }));
  assert.throws(() => panelActionSchema.parse({
    type: 'confrontation.close',
    confrontationId: 1,
    reason: 'x'.repeat(501),
  }));
});

test('limits command actions to activation of existing names', () => {
  assert.deepEqual(panelActionSchema.parse({
    type: 'command.set-enabled',
    commandName: 'criar-confronto',
    enabled: false,
  }), {
    type: 'command.set-enabled',
    commandName: 'criar-confronto',
    enabled: false,
  });
  assert.throws(() => panelActionSchema.parse({
    type: 'command.set-enabled',
    commandName: 'Bad Command',
    enabled: true,
  }));
});
