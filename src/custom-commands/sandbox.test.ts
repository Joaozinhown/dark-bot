import assert from 'node:assert/strict';
import test from 'node:test';
import { runSandboxScript } from './sandbox';

const context = {
  user: { id: '123', username: 'staff' },
  guild: { id: '456', name: 'DTA' },
  channel: { id: '789' },
  locale: 'pt-BR' as const,
  options: {},
  variables: {},
};

test('sandbox emits only validated Discord SDK actions', async () => {
  const result = await runSandboxScript(`
    discord.reply({ content: { ptBR: 'Ola', enUS: 'Hello' }, ephemeral: true });
    discord.setVariable({ name: 'status', value: 'ok' });
    console.log(context.guild.name);
  `, context);
  assert.equal(result.workflow[0]?.type, 'reply');
  assert.equal(result.workflow[1]?.type, 'set_variable');
  assert.deepEqual(result.logs, ['DTA']);
});

test('sandbox blocks Node globals', async () => {
  const result = await runSandboxScript(`
    discord.reply(String(typeof process) + ':' + String(typeof require) + ':' + String(typeof fetch));
  `, context);
  const step = result.workflow[0];
  assert.equal(step?.type, 'reply');
  if (step?.type === 'reply') assert.equal(step.message.content?.ptBR, 'undefined:undefined:undefined');
});

test('sandbox interrupts infinite loops', async () => {
  await assert.rejects(
    runSandboxScript('while (true) {}', context),
    /interrupted|sandbox/i,
  );
});
