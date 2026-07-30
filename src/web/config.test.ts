import assert from 'node:assert/strict';
import test from 'node:test';
import { readPanelConfig } from './config';

const validEnvironment = {
  ADMIN_PANEL_ENABLED: 'true',
  CLIENT_ID: '123456789012345678',
  DISCORD_CLIENT_SECRET: 'discord-secret',
  DISCORD_REDIRECT_URI: 'https://admin-dta-bot.discloud.app/api/auth/callback',
  PANEL_COOKIE_SECRET: 'a'.repeat(32),
  PANEL_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
  PORT: '8080',
};

test('keeps panel disabled without requiring new environment variables', () => {
  assert.deepEqual(readPanelConfig({}), { enabled: false });
});

test('parses a complete enabled panel configuration', () => {
  const config = readPanelConfig(validEnvironment);

  assert.equal(config.enabled, true);
  if (!config.enabled) return;
  assert.equal(config.port, 8080);
  assert.equal(config.isProduction, true);
  assert.equal(config.encryptionKey.length, 32);
});

test('rejects incomplete, weak, or invalid enabled configuration', () => {
  assert.throws(
    () => readPanelConfig({ ...validEnvironment, PANEL_COOKIE_SECRET: 'short' }),
    /PANEL_COOKIE_SECRET/i,
  );
  assert.throws(
    () => readPanelConfig({ ...validEnvironment, PANEL_ENCRYPTION_KEY: 'not-base64' }),
    /PANEL_ENCRYPTION_KEY/i,
  );
  assert.throws(
    () => readPanelConfig({ ...validEnvironment, DISCORD_REDIRECT_URI: 'http://remote.example.com/callback' }),
    /DISCORD_REDIRECT_URI/i,
  );
});

test('allows an HTTP redirect only on loopback for local development', () => {
  const config = readPanelConfig({
    ...validEnvironment,
    DISCORD_REDIRECT_URI: 'http://127.0.0.1:8080/api/auth/callback',
  });
  assert.equal(config.enabled, true);
  if (config.enabled) assert.equal(config.isProduction, false);
});

test('rejects an unapproved HTTPS redirect in production', () => {
  assert.throws(
    () => readPanelConfig({
      ...validEnvironment,
      DISCORD_REDIRECT_URI: 'https://dta-admin.discloud.app/api/auth/callback',
      NODE_ENV: 'production',
    }),
    /DISCORD_REDIRECT_URI/i,
  );
  assert.throws(
    () => readPanelConfig({
      ...validEnvironment,
      DISCORD_REDIRECT_URI: 'https://admin-dta-bot.discloud.app/api/auth/callback?next=invalid',
      NODE_ENV: 'production',
    }),
    /DISCORD_REDIRECT_URI/i,
  );
});
