import assert from 'node:assert/strict';
import test from 'node:test';
import type { PanelConfig } from './config';
import { readPanelConfigSafely, runPanelBeforeBot } from './startup';

const disabledConfig: PanelConfig = { enabled: false };
const enabledConfig: PanelConfig = {
  enabled: true,
  clientId: '123456789012345678',
  clientSecret: 'secret',
  redirectUri: 'https://panel.example.com/api/auth/callback',
  cookieSecret: 'c'.repeat(32),
  encryptionKey: Buffer.alloc(32, 1),
  port: 8080,
  isProduction: true,
};

test('starts the bot without attempting the panel when it is disabled', async () => {
  const calls: string[] = [];

  await runPanelBeforeBot({
    config: disabledConfig,
    startPanel: async () => { calls.push('panel'); },
    startBot: async () => { calls.push('bot'); },
    reportPanelError: () => { calls.push('error'); },
  });

  assert.deepEqual(calls, ['bot']);
});

test('continues bot startup after the panel listener fails', async () => {
  const calls: string[] = [];

  await runPanelBeforeBot({
    config: enabledConfig,
    startPanel: async () => {
      calls.push('panel');
      throw new Error('address already in use');
    },
    startBot: async () => { calls.push('bot'); },
    reportPanelError: error => {
      assert.match(error instanceof Error ? error.message : String(error), /address already in use/);
      calls.push('error');
    },
  });

  assert.deepEqual(calls, ['panel', 'error', 'bot']);
});

test('starts the panel before continuing bot startup when enabled', async () => {
  const calls: string[] = [];

  await runPanelBeforeBot({
    config: enabledConfig,
    startPanel: async () => { calls.push('panel'); },
    startBot: async () => { calls.push('bot'); },
    reportPanelError: () => { calls.push('error'); },
  });

  assert.deepEqual(calls, ['panel', 'bot']);
});

test('turns invalid panel configuration into a disabled panel', () => {
  const errors: unknown[] = [];

  const config = readPanelConfigSafely({
    readConfig: () => { throw new Error('missing client secret'); },
    reportConfigError: error => errors.push(error),
  });

  assert.deepEqual(config, { enabled: false });
  assert.equal(errors.length, 1);
  assert.match(errors[0] instanceof Error ? errors[0].message : String(errors[0]), /client secret/);
});
