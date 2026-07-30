import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createOpaqueToken,
  decryptSecret,
  encryptSecret,
  parseEncryptionKey,
  verifyOpaqueToken,
} from './crypto';

const KEY = Buffer.alloc(32, 7).toString('base64');

test('accepts only canonical base64 keys containing exactly 32 bytes', () => {
  assert.equal(parseEncryptionKey(KEY).byteLength, 32);

  for (const invalid of ['', 'not-base64', Buffer.alloc(31).toString('base64'), `${KEY}\n`]) {
    assert.throws(() => parseEncryptionKey(invalid), /32-byte base64/i);
  }
});

test('encrypts OAuth secrets with authenticated randomized AES-256-GCM', () => {
  const first = encryptSecret('oauth-access-token', KEY);
  const second = encryptSecret('oauth-access-token', KEY);

  assert.notEqual(first, second);
  assert.equal(first.includes('oauth-access-token'), false);
  assert.equal(decryptSecret(first, KEY), 'oauth-access-token');
  assert.throws(() => decryptSecret(first, Buffer.alloc(32, 9).toString('base64')));

  const tampered = `${first.slice(0, -1)}${first.endsWith('A') ? 'B' : 'A'}`;
  assert.throws(() => decryptSecret(tampered, KEY));
});

test('creates opaque random values whose stored representation is SHA-256', () => {
  const first = createOpaqueToken();
  const second = createOpaqueToken();

  assert.notEqual(first.token, second.token);
  assert.match(first.hash, /^[a-f0-9]{64}$/);
  assert.equal(verifyOpaqueToken(first.token, first.hash), true);
  assert.equal(verifyOpaqueToken(second.token, first.hash), false);
  assert.equal(verifyOpaqueToken(first.token, 'invalid'), false);
});
