import assert from 'node:assert/strict';
import test from 'node:test';
import { createBlankCommandDefinition } from './definition';
import { compileDiscordCommand, createNativeFactoryDefinition } from './compiler';

test('compiles bilingual slash command payloads', () => {
  const definition = createBlankCommandDefinition('saudacao');
  definition.command.name.enUS = 'greeting';
  definition.command.description = { ptBR: 'Envia uma saudacao', enUS: 'Sends a greeting' };
  definition.command.options.push({
    kind: 'parameter',
    id: 'target_user',
    key: 'usuario',
    type: 'user',
    name: { ptBR: 'usuario', enUS: 'user' },
    description: { ptBR: 'Usuario alvo', enUS: 'Target user' },
    required: true,
  });

  const payload = compileDiscordCommand(definition);
  assert.equal(payload.name, 'saudacao');
  assert.equal(payload.name_localizations['en-US'], 'greeting');
  assert.equal((payload.options[0] as { type: number }).type, 6);
});

test('converts native payload into a restorable factory definition', () => {
  const definition = createNativeFactoryDefinition({
    name: 'ranking',
    description: 'Mostra ranking',
    options: [],
  }, false);
  assert.equal(definition.execution.mode, 'native');
  assert.equal(definition.execution.factoryCommandName, 'ranking');
  assert.equal(definition.command.name.enUS, 'ranking');
});

test('rejects workflow definitions without executable steps', () => {
  const definition = createBlankCommandDefinition('vazio');
  definition.workflow = [];
  assert.throws(() => compileDiscordCommand(definition), /ao menos uma etapa/);
});
