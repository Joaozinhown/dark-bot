import assert from 'node:assert/strict';
import test from 'node:test';
import { runtimeLogService } from './runtime-log-service';

test('returns a bounded runtime snapshot when Discloud token is absent', async () => {
  const previousToken = process.env.DISCLOUD_TOKEN;
  delete process.env.DISCLOUD_TOKEN;
  try {
    const snapshot = await runtimeLogService.getSnapshot();
    assert.equal(snapshot.source, 'runtime');
    assert.equal(snapshot.isExactDiscloudSnapshot, false);
    assert.equal(typeof snapshot.content, 'string');
    assert.ok(snapshot.content.length <= 300_000);
  } finally {
    if (previousToken) process.env.DISCLOUD_TOKEN = previousToken;
  }
});

test('returns the exact terminal snapshot from the official Discloud endpoint', async () => {
  const previousToken = process.env.DISCLOUD_TOKEN;
  const previousAppId = process.env.DISCLOUD_APP_ID;
  const originalFetch = globalThis.fetch;
  process.env.DISCLOUD_TOKEN = 'private-test-token';
  process.env.DISCLOUD_APP_ID = 'admin-dta-bot';
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), 'https://api.discloud.app/v2/app/admin-dta-bot/logs');
    assert.equal((init?.headers as Record<string, string>)['api-token'], 'private-test-token');
    return new Response(JSON.stringify({ apps: { terminal: { big: 'linha exata da Discloud' } } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  try {
    const snapshot = await runtimeLogService.getSnapshot();
    assert.equal(snapshot.source, 'discloud');
    assert.equal(snapshot.isExactDiscloudSnapshot, true);
    assert.equal(snapshot.content, 'linha exata da Discloud');
  } finally {
    globalThis.fetch = originalFetch;
    if (previousToken === undefined) delete process.env.DISCLOUD_TOKEN;
    else process.env.DISCLOUD_TOKEN = previousToken;
    if (previousAppId === undefined) delete process.env.DISCLOUD_APP_ID;
    else process.env.DISCLOUD_APP_ID = previousAppId;
  }
});
