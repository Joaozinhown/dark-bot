import assert from 'node:assert/strict';
import test from 'node:test';
import type { CustomCommand } from '@prisma/client';
import { createBlankCommandDefinition } from './definition';
import { composeGuildCommandPayloads } from './registry';
import type { CommandRegistrationState } from './service';

function registration(input: Partial<CustomCommand> & { id: number; sourceType: string; enabled: boolean }, isPublished = true): CommandRegistrationState {
  const definition = createBlankCommandDefinition(input.name ?? 'custom');
  return {
    command: {
      guildId: 'guild', stableKey: `custom:${input.id}`, factoryCommandName: null,
      name: definition.command.name.ptBR, description: definition.command.description.ptBR,
      draftDefinition: JSON.stringify(definition), status: 'published',
      publishedVersionId: isPublished ? input.id : null, discordCommandId: null,
      createdByUserId: 'user', updatedByUserId: 'user', criadoEm: new Date(), atualizadoEm: new Date(),
      ...input,
    },
    version: null,
    definition: isPublished ? definition : null,
  };
}

test('keeps factory commands for drafts and suppresses disabled native overrides', () => {
  const native = [{ name: 'ranking', description: 'Ranking' }, { name: 'perfil', description: 'Perfil' }];
  const draft = registration({ id: 1, sourceType: 'native', factoryCommandName: 'ranking', name: 'ranking', enabled: true }, false);
  const disabled = registration({ id: 2, sourceType: 'native', factoryCommandName: 'perfil', name: 'perfil', enabled: false });
  const result = composeGuildCommandPayloads('guild', native, [draft, disabled]);
  assert.deepEqual(result.payloads, [native[0]]);
  assert.equal(result.dynamicByName.size, 0);
});

test('registers published custom commands and maps their Discord names', () => {
  const custom = registration({ id: 7, sourceType: 'custom', name: 'custom', enabled: true });
  const result = composeGuildCommandPayloads('guild', [], [custom]);
  assert.equal(result.payloads.length, 1);
  assert.equal((result.payloads[0] as { name: string }).name, 'custom');
  assert.equal(result.dynamicByName.get('custom'), 7);
});
