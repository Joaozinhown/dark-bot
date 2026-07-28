import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createSessionService,
  type SessionRecord,
  type SessionStore,
  type SessionStoreCreateInput,
  type SessionTokenUpdate,
} from './session-service';

const KEY = Buffer.alloc(32, 4).toString('base64');
const NOW = new Date('2026-07-28T12:00:00.000Z');

function createMemoryStore() {
  const records = new Map<string, SessionRecord>();
  const store: SessionStore = {
    create: async (input: SessionStoreCreateInput) => {
      const record: SessionRecord = {
        ...input,
        criadoEm: NOW,
        atualizadoEm: NOW,
        ultimoAcessoEm: NOW,
        revogadoEm: null,
      };
      records.set(record.id, record);
      return record;
    },
    findById: async id => records.get(id) ?? null,
    touchActive: async (id, at) => {
      const current = records.get(id);
      if (!current || current.revogadoEm || current.expiresAt <= at) return null;
      const updated = { ...current, ultimoAcessoEm: at, atualizadoEm: at };
      records.set(id, updated);
      return updated;
    },
    revokeActive: async (id, at) => {
      const current = records.get(id);
      if (!current || current.revogadoEm || current.expiresAt <= at) return false;
      records.set(id, { ...current, revogadoEm: at, atualizadoEm: at });
      return true;
    },
    updateTokensActive: async (id, update: SessionTokenUpdate, at) => {
      const current = records.get(id);
      if (!current || current.revogadoEm || current.expiresAt <= at) return false;
      records.set(id, { ...current, ...update, atualizadoEm: at });
      return true;
    },
  };
  return { records, store };
}

test('rejects an invalid encryption key when the service is created', () => {
  const { store } = createMemoryStore();
  assert.throws(
    () => createSessionService({ store, encryptionKey: 'invalid' }),
    /32-byte base64/i,
  );
});

test('creates a DB-backed session using hashed opaque tokens and encrypted OAuth secrets', async () => {
  const { records, store } = createMemoryStore();
  const service = createSessionService({ store, encryptionKey: KEY, now: () => NOW });

  const created = await service.create({
    userId: 'user-1',
    username: 'Matheus',
    avatarHash: null,
    accessToken: 'access-secret',
    refreshToken: 'refresh-secret',
  });
  const stored = [...records.values()][0];

  assert.match(stored.id, /^[a-f0-9]{64}$/);
  assert.match(stored.csrfTokenHash, /^[a-f0-9]{64}$/);
  assert.notEqual(stored.id, created.sessionToken);
  assert.notEqual(stored.csrfTokenHash, created.csrfToken);
  assert.equal(stored.accessTokenEncrypted.includes('access-secret'), false);
  assert.equal(stored.refreshTokenEncrypted?.includes('refresh-secret'), false);
  assert.deepEqual(Object.keys(created.session).sort(), [
    'avatarHash', 'expiresAt', 'lastAccessAt', 'userId', 'username',
  ]);
  assert.equal(JSON.stringify(created).includes('Encrypted'), false);
});

test('resolves, verifies CSRF, touches and decrypts only active sessions', async () => {
  const { store } = createMemoryStore();
  let now = NOW;
  const service = createSessionService({ store, encryptionKey: KEY, now: () => now });
  const created = await service.create({
    userId: 'user-1',
    username: 'Matheus',
    accessToken: 'access-secret',
    refreshToken: 'refresh-secret',
  });

  assert.equal((await service.resolve(created.sessionToken))?.userId, 'user-1');
  assert.equal(await service.verifyCsrf(created.sessionToken, created.csrfToken), true);
  assert.equal(await service.verifyCsrf(created.sessionToken, 'wrong-token'), false);
  assert.deepEqual(await service.readOAuthTokens(created.sessionToken), {
    accessToken: 'access-secret',
    refreshToken: 'refresh-secret',
  });

  now = new Date(NOW.getTime() + 60_000);
  assert.equal((await service.touch(created.sessionToken))?.lastAccessAt.getTime(), now.getTime());
});

test('revokes sessions and refuses every subsequent read or mutation', async () => {
  const { store } = createMemoryStore();
  const service = createSessionService({ store, encryptionKey: KEY, now: () => NOW });
  const created = await service.create({
    userId: 'user-1', username: 'Matheus', accessToken: 'access-secret',
  });

  assert.equal(await service.revoke(created.sessionToken), true);
  assert.equal(await service.revoke(created.sessionToken), false);
  assert.equal(await service.resolve(created.sessionToken), null);
  assert.equal(await service.verifyCsrf(created.sessionToken, created.csrfToken), false);
  assert.equal(await service.touch(created.sessionToken), null);
  assert.equal(await service.readOAuthTokens(created.sessionToken), null);
  assert.equal(await service.replaceOAuthTokens(created.sessionToken, {
    accessToken: 'new-access', refreshToken: 'new-refresh',
  }), false);
});

test('expires sessions and stores refreshed OAuth tokens without exposing ciphertext', async () => {
  const { records, store } = createMemoryStore();
  let now = NOW;
  const service = createSessionService({
    store,
    encryptionKey: KEY,
    now: () => now,
    sessionTtlMs: 1_000,
  });
  const created = await service.create({
    userId: 'user-1', username: 'Matheus', accessToken: 'old-access', refreshToken: 'old-refresh',
  });

  assert.equal(await service.replaceOAuthTokens(created.sessionToken, {
    accessToken: 'new-access', refreshToken: 'new-refresh',
  }), true);
  assert.deepEqual(await service.readOAuthTokens(created.sessionToken), {
    accessToken: 'new-access', refreshToken: 'new-refresh',
  });
  assert.equal(JSON.stringify([...records.values()]).includes('new-access'), false);

  now = new Date(NOW.getTime() + 1_001);
  assert.equal(await service.resolve(created.sessionToken), null);
  assert.equal(await service.touch(created.sessionToken), null);
  assert.equal(await service.revoke(created.sessionToken), false);
});

test('does not return a session if it is revoked during a touch', async () => {
  const { store } = createMemoryStore();
  const service = createSessionService({
    store: {
      ...store,
      touchActive: async (id, at) => {
        const touched = await store.touchActive(id, at);
        return touched ? { ...touched, revogadoEm: at } : null;
      },
    },
    encryptionKey: KEY,
    now: () => NOW,
  });
  const created = await service.create({
    userId: 'user-1', username: 'Matheus', accessToken: 'access-secret',
  });

  assert.equal(await service.touch(created.sessionToken), null);
});
