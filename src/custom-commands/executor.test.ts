import assert from 'node:assert/strict';
import test from 'node:test';
import type { ChatInputCommandInteraction } from 'discord.js';
import { createBlankCommandDefinition } from './definition';
import { executeDynamicCommand } from './executor';

function mockInteraction() {
  const replies: unknown[] = [];
  const interaction = {
    locale: 'pt-BR',
    user: { id: '123456789012345678', username: 'tester' },
    guildId: '223456789012345678',
    guild: { id: '223456789012345678', name: 'Guild' },
    channelId: '323456789012345678',
    replied: false,
    deferred: false,
    options: { data: [] },
    async reply(payload: unknown) {
      replies.push(payload);
      interaction.replied = true;
    },
    async followUp() {
      throw new Error('followUp cannot be the initial acknowledgement');
    },
  };
  return { interaction: interaction as unknown as ChatInputCommandInteraction, replies };
}

test('acknowledges workflows that only change internal state', async () => {
  const definition = createBlankCommandDefinition('state');
  definition.workflow = [{ id: 'state_1', type: 'set_variable', name: 'result', value: 'ok' }];
  const { interaction, replies } = mockInteraction();
  await executeDynamicCommand(interaction, { commandId: 1, versionId: 1, definition });
  assert.equal(replies.length, 1);
  assert.match(String((replies[0] as { content: string }).content), /Comando executado/);
});

test('uses the initial reply slot when a workflow starts with followup', async () => {
  const definition = createBlankCommandDefinition('followup');
  const initial = definition.workflow[0];
  assert.ok(initial && initial.type === 'reply');
  definition.workflow = [{ id: initial.id, type: 'followup', message: initial.message }];
  const { interaction, replies } = mockInteraction();
  await executeDynamicCommand(interaction, { commandId: 1, versionId: 1, definition });
  assert.equal(replies.length, 1);
  assert.equal((replies[0] as { content: string }).content, 'Resposta do comando');
});
