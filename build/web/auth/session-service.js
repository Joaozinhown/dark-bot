"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSessionService = createSessionService;
const client_1 = __importDefault(require("../../database/client"));
const crypto_1 = require("./crypto");
const DEFAULT_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1_000;
function toPublicSession(record) {
    return {
        userId: record.userId,
        username: record.username,
        avatarHash: record.avatarHash,
        expiresAt: record.expiresAt,
        lastAccessAt: record.ultimoAcessoEm,
    };
}
function isActive(record, now) {
    return record.revogadoEm === null && record.expiresAt > now;
}
async function findAfterActiveUpdate(id) {
    return client_1.default.webSession.findUnique({ where: { id } });
}
const prismaSessionStore = {
    create: input => client_1.default.webSession.create({ data: input }),
    findById: id => client_1.default.webSession.findUnique({ where: { id } }),
    async touchActive(id, at) {
        const result = await client_1.default.webSession.updateMany({
            where: { id, revogadoEm: null, expiresAt: { gt: at } },
            data: { ultimoAcessoEm: at },
        });
        return result.count === 1 ? findAfterActiveUpdate(id) : null;
    },
    async revokeActive(id, at) {
        const result = await client_1.default.webSession.updateMany({
            where: { id, revogadoEm: null, expiresAt: { gt: at } },
            data: { revogadoEm: at },
        });
        return result.count === 1;
    },
    async updateTokensActive(id, update, at) {
        const result = await client_1.default.webSession.updateMany({
            where: { id, revogadoEm: null, expiresAt: { gt: at } },
            data: update,
        });
        return result.count === 1;
    },
    async deleteExpiredOrRevoked(at) {
        const result = await client_1.default.webSession.deleteMany({
            where: {
                OR: [
                    { expiresAt: { lte: at } },
                    { revogadoEm: { not: null } },
                ],
            },
        });
        return result.count;
    },
};
function createSessionService(options) {
    (0, crypto_1.parseEncryptionKey)(options.encryptionKey);
    const store = options.store ?? prismaSessionStore;
    const now = options.now ?? (() => new Date());
    const sessionTtlMs = options.sessionTtlMs ?? DEFAULT_SESSION_TTL_MS;
    if (!Number.isSafeInteger(sessionTtlMs) || sessionTtlMs <= 0) {
        throw new Error('Session TTL must be a positive integer');
    }
    async function findActive(sessionToken) {
        const record = await store.findById((0, crypto_1.hashOpaqueToken)(sessionToken));
        return record && isActive(record, now()) ? record : null;
    }
    return {
        async create(input) {
            const createdAt = now();
            const expiresAt = input.expiresAt ?? new Date(createdAt.getTime() + sessionTtlMs);
            if (expiresAt <= createdAt)
                throw new Error('Session expiration must be in the future');
            await store.deleteExpiredOrRevoked(createdAt);
            const session = (0, crypto_1.createOpaqueToken)();
            const csrf = (0, crypto_1.createOpaqueToken)();
            const record = await store.create({
                id: session.hash,
                userId: input.userId,
                username: input.username,
                avatarHash: input.avatarHash ?? null,
                accessTokenEncrypted: (0, crypto_1.encryptSecret)(input.accessToken, options.encryptionKey),
                refreshTokenEncrypted: input.refreshToken
                    ? (0, crypto_1.encryptSecret)(input.refreshToken, options.encryptionKey)
                    : null,
                expiresAt,
                csrfTokenHash: csrf.hash,
            });
            return {
                sessionToken: session.token,
                csrfToken: csrf.token,
                session: toPublicSession(record),
            };
        },
        async resolve(sessionToken) {
            const record = await findActive(sessionToken);
            return record ? toPublicSession(record) : null;
        },
        async verifyCsrf(sessionToken, csrfToken) {
            const record = await findActive(sessionToken);
            return record ? (0, crypto_1.verifyOpaqueToken)(csrfToken, record.csrfTokenHash) : false;
        },
        async touch(sessionToken) {
            const touchedAt = now();
            const record = await store.touchActive((0, crypto_1.hashOpaqueToken)(sessionToken), touchedAt);
            return record && isActive(record, touchedAt) ? toPublicSession(record) : null;
        },
        revoke(sessionToken) {
            return store.revokeActive((0, crypto_1.hashOpaqueToken)(sessionToken), now());
        },
        async readOAuthTokens(sessionToken) {
            const record = await findActive(sessionToken);
            if (!record)
                return null;
            return {
                accessToken: (0, crypto_1.decryptSecret)(record.accessTokenEncrypted, options.encryptionKey),
                refreshToken: record.refreshTokenEncrypted
                    ? (0, crypto_1.decryptSecret)(record.refreshTokenEncrypted, options.encryptionKey)
                    : null,
            };
        },
        replaceOAuthTokens(sessionToken, tokens) {
            return store.updateTokensActive((0, crypto_1.hashOpaqueToken)(sessionToken), {
                accessTokenEncrypted: (0, crypto_1.encryptSecret)(tokens.accessToken, options.encryptionKey),
                refreshTokenEncrypted: tokens.refreshToken
                    ? (0, crypto_1.encryptSecret)(tokens.refreshToken, options.encryptionKey)
                    : null,
            }, now());
        },
    };
}
//# sourceMappingURL=session-service.js.map