import assert from 'node:assert/strict';
import test from 'node:test';
import { panelActionSchema } from './panel-actions';
import { createBlankCommandDefinition } from '../custom-commands/definition';

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

test('accepts static activation and validated dynamic command drafts', () => {
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
  const definition = createBlankCommandDefinition('hello');
  const draft = panelActionSchema.parse({
    type: 'command.save-draft',
    commandId: null,
    sourceType: 'custom',
    factoryCommandName: null,
    definition,
  });
  assert.equal(draft.type, 'command.save-draft');
  assert.equal(draft.definition.command.name.enUS, 'hello');
  assert.throws(() => panelActionSchema.parse({
    type: 'command.preview',
    definition: { ...definition, workflow: [] },
  }));
});

test('validates separate role and user access for scripts', () => {
  const parsed = panelActionSchema.parse({
    type: 'permission.set-script-access',
    roleIds: [ROLE_ID],
    userIds: ['223456789012345678'],
  });
  assert.equal(parsed.type, 'permission.set-script-access');
  assert.throws(() => panelActionSchema.parse({
    type: 'permission.set-script-access',
    roleIds: ['not-a-role'],
    userIds: [],
  }));
});
