"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = __importDefault(require("node:test"));
const session_service_1 = require("./session-service");
const KEY = Buffer.alloc(32, 4).toString('base64');
const NOW = new Date('2026-07-28T12:00:00.000Z');
function createMemoryStore() {
    const records = new Map();
    const store = {
        create: async (input) => {
            const record = {
                ...input,
                criadoEm: NOW,
                atualizadoEm: NOW,
                ultimoAcessoEm: NOW,
                revogadoEm: null,
            };
            records.set(record.id, record);
            return record;
        },
        findById: async (id) => records.get(id) ?? null,
        touchActive: async (id, at) => {
            const current = records.get(id);
            if (!current || current.revogadoEm || current.expiresAt <= at)
                return null;
            const updated = { ...current, ultimoAcessoEm: at, atualizadoEm: at };
            records.set(id, updated);
            return updated;
        },
        revokeActive: async (id, at) => {
            const current = records.get(id);
            if (!current || current.revogadoEm || current.expiresAt <= at)
                return false;
            records.set(id, { ...current, revogadoEm: at, atualizadoEm: at });
            return true;
        },
        updateTokensActive: async (id, update, at) => {
            const current = records.get(id);
            if (!current || current.revogadoEm || current.expiresAt <= at)
                return false;
            records.set(id, { ...current, ...update, atualizadoEm: at });
            return true;
        },
        deleteExpiredOrRevoked: async (at) => {
            let deleted = 0;
            for (const [id, record] of records) {
                if (record.expiresAt <= at || record.revogadoEm !== null) {
                    records.delete(id);
                    deleted += 1;
                }
            }
            return deleted;
        },
    };
    return { records, store };
}
(0, node_test_1.default)('rejects an invalid encryption key when the service is created', () => {
    const { store } = createMemoryStore();
    strict_1.default.throws(() => (0, session_service_1.createSessionService)({ store, encryptionKey: 'invalid' }), /32-byte base64/i);
});
(0, node_test_1.default)('creates a DB-backed session using hashed opaque tokens and encrypted OAuth secrets', async () => {
    const { records, store } = createMemoryStore();
    const service = (0, session_service_1.createSessionService)({ store, encryptionKey: KEY, now: () => NOW });
    const created = await service.create({
        userId: 'user-1',
        username: 'Matheus',
        avatarHash: null,
        accessToken: 'access-secret',
        refreshToken: 'refresh-secret',
    });
    const stored = [...records.values()][0];
    strict_1.default.match(stored.id, /^[a-f0-9]{64}$/);
    strict_1.default.match(stored.csrfTokenHash, /^[a-f0-9]{64}$/);
    strict_1.default.notEqual(stored.id, created.sessionToken);
    strict_1.default.notEqual(stored.csrfTokenHash, created.csrfToken);
    strict_1.default.equal(stored.accessTokenEncrypted.includes('access-secret'), false);
    strict_1.default.equal(stored.refreshTokenEncrypted?.includes('refresh-secret'), false);
    strict_1.default.deepEqual(Object.keys(created.session).sort(), [
        'avatarHash', 'expiresAt', 'lastAccessAt', 'userId', 'username',
    ]);
    strict_1.default.equal(JSON.stringify(created).includes('Encrypted'), false);
});
(0, node_test_1.default)('resolves, verifies CSRF, touches and decrypts only active sessions', async () => {
    const { store } = createMemoryStore();
    let now = NOW;
    const service = (0, session_service_1.createSessionService)({ store, encryptionKey: KEY, now: () => now });
    const created = await service.create({
        userId: 'user-1',
        username: 'Matheus',
        accessToken: 'access-secret',
        refreshToken: 'refresh-secret',
    });
    strict_1.default.equal((await service.resolve(created.sessionToken))?.userId, 'user-1');
    strict_1.default.equal(await service.verifyCsrf(created.sessionToken, created.csrfToken), true);
    strict_1.default.equal(await service.verifyCsrf(created.sessionToken, 'wrong-token'), false);
    strict_1.default.deepEqual(await service.readOAuthTokens(created.sessionToken), {
        accessToken: 'access-secret',
        refreshToken: 'refresh-secret',
    });
    now = new Date(NOW.getTime() + 60_000);
    strict_1.default.equal((await service.touch(created.sessionToken))?.lastAccessAt.getTime(), now.getTime());
});
(0, node_test_1.default)('revokes sessions and refuses every subsequent read or mutation', async () => {
    const { store } = createMemoryStore();
    const service = (0, session_service_1.createSessionService)({ store, encryptionKey: KEY, now: () => NOW });
    const created = await service.create({
        userId: 'user-1', username: 'Matheus', accessToken: 'access-secret',
    });
    strict_1.default.equal(await service.revoke(created.sessionToken), true);
    strict_1.default.equal(await service.revoke(created.sessionToken), false);
    strict_1.default.equal(await service.resolve(created.sessionToken), null);
    strict_1.default.equal(await service.verifyCsrf(created.sessionToken, created.csrfToken), false);
    strict_1.default.equal(await service.touch(created.sessionToken), null);
    strict_1.default.equal(await service.readOAuthTokens(created.sessionToken), null);
    strict_1.default.equal(await service.replaceOAuthTokens(created.sessionToken, {
        accessToken: 'new-access', refreshToken: 'new-refresh',
    }), false);
});
(0, node_test_1.default)('expires sessions and stores refreshed OAuth tokens without exposing ciphertext', async () => {
    const { records, store } = createMemoryStore();
    let now = NOW;
    const service = (0, session_service_1.createSessionService)({
        store,
        encryptionKey: KEY,
        now: () => now,
        sessionTtlMs: 1_000,
    });
    const created = await service.create({
        userId: 'user-1', username: 'Matheus', accessToken: 'old-access', refreshToken: 'old-refresh',
    });
    strict_1.default.equal(await service.replaceOAuthTokens(created.sessionToken, {
        accessToken: 'new-access', refreshToken: 'new-refresh',
    }), true);
    strict_1.default.deepEqual(await service.readOAuthTokens(created.sessionToken), {
        accessToken: 'new-access', refreshToken: 'new-refresh',
    });
    strict_1.default.equal(JSON.stringify([...records.values()]).includes('new-access'), false);
    now = new Date(NOW.getTime() + 1_001);
    strict_1.default.equal(await service.resolve(created.sessionToken), null);
    strict_1.default.equal(await service.touch(created.sessionToken), null);
    strict_1.default.equal(await service.revoke(created.sessionToken), false);
});
(0, node_test_1.default)('prunes expired sessions before creating a new session', async () => {
    const { records, store } = createMemoryStore();
    let now = NOW;
    const service = (0, session_service_1.createSessionService)({
        store,
        encryptionKey: KEY,
        now: () => now,
        sessionTtlMs: 1_000,
    });
    await service.create({ userId: 'user-1', username: 'Matheus', accessToken: 'first' });
    now = new Date(NOW.getTime() + 1_001);
    await service.create({ userId: 'user-1', username: 'Matheus', accessToken: 'second' });
    strict_1.default.equal(records.size, 1);
});
(0, node_test_1.default)('does not return a session if it is revoked during a touch', async () => {
    const { store } = createMemoryStore();
    const service = (0, session_service_1.createSessionService)({
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
    strict_1.default.equal(await service.touch(created.sessionToken), null);
});
//# sourceMappingURL=session-service.test.js.map