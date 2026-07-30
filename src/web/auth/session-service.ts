import prisma from '../../database/client';
import {
  createOpaqueToken,
  decryptSecret,
  encryptSecret,
  hashOpaqueToken,
  parseEncryptionKey,
  verifyOpaqueToken,
} from './crypto';

const DEFAULT_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1_000;

export interface SessionRecord {
  id: string;
  userId: string;
  username: string;
  avatarHash: string | null;
  accessTokenEncrypted: string;
  refreshTokenEncrypted: string | null;
  expiresAt: Date;
  csrfTokenHash: string;
  criadoEm: Date;
  atualizadoEm: Date;
  ultimoAcessoEm: Date;
  revogadoEm: Date | null;
}

export type SessionStoreCreateInput = Omit<
  SessionRecord,
  'criadoEm' | 'atualizadoEm' | 'ultimoAcessoEm' | 'revogadoEm'
>;

export interface SessionTokenUpdate {
  accessTokenEncrypted: string;
  refreshTokenEncrypted: string | null;
}

export interface SessionStore {
  create(input: SessionStoreCreateInput): Promise<SessionRecord>;
  findById(id: string): Promise<SessionRecord | null>;
  touchActive(id: string, at: Date): Promise<SessionRecord | null>;
  revokeActive(id: string, at: Date): Promise<boolean>;
  updateTokensActive(id: string, update: SessionTokenUpdate, at: Date): Promise<boolean>;
}

export interface PublicSession {
  userId: string;
  username: string;
  avatarHash: string | null;
  expiresAt: Date;
  lastAccessAt: Date;
}

export interface CreateSessionInput {
  userId: string;
  username: string;
  avatarHash?: string | null;
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: Date;
}

export interface CreatedSession {
  sessionToken: string;
  csrfToken: string;
  session: PublicSession;
}

export interface OAuthSessionTokens {
  accessToken: string;
  refreshToken: string | null;
}

export interface SessionServiceOptions {
  encryptionKey: string;
  store?: SessionStore;
  now?: () => Date;
  sessionTtlMs?: number;
}

function toPublicSession(record: SessionRecord): PublicSession {
  return {
    userId: record.userId,
    username: record.username,
    avatarHash: record.avatarHash,
    expiresAt: record.expiresAt,
    lastAccessAt: record.ultimoAcessoEm,
  };
}

function isActive(record: SessionRecord, now: Date): boolean {
  return record.revogadoEm === null && record.expiresAt > now;
}

async function findAfterActiveUpdate(id: string): Promise<SessionRecord | null> {
  return prisma.webSession.findUnique({ where: { id } });
}

const prismaSessionStore: SessionStore = {
  create: input => prisma.webSession.create({ data: input }),
  findById: id => prisma.webSession.findUnique({ where: { id } }),
  async touchActive(id, at) {
    const result = await prisma.webSession.updateMany({
      where: { id, revogadoEm: null, expiresAt: { gt: at } },
      data: { ultimoAcessoEm: at },
    });
    return result.count === 1 ? findAfterActiveUpdate(id) : null;
  },
  async revokeActive(id, at) {
    const result = await prisma.webSession.updateMany({
      where: { id, revogadoEm: null, expiresAt: { gt: at } },
      data: { revogadoEm: at },
    });
    return result.count === 1;
  },
  async updateTokensActive(id, update, at) {
    const result = await prisma.webSession.updateMany({
      where: { id, revogadoEm: null, expiresAt: { gt: at } },
      data: update,
    });
    return result.count === 1;
  },
};

export function createSessionService(options: SessionServiceOptions) {
  parseEncryptionKey(options.encryptionKey);
  const store = options.store ?? prismaSessionStore;
  const now = options.now ?? (() => new Date());
  const sessionTtlMs = options.sessionTtlMs ?? DEFAULT_SESSION_TTL_MS;
  if (!Number.isSafeInteger(sessionTtlMs) || sessionTtlMs <= 0) {
    throw new Error('Session TTL must be a positive integer');
  }

  async function findActive(sessionToken: string): Promise<SessionRecord | null> {
    const record = await store.findById(hashOpaqueToken(sessionToken));
    return record && isActive(record, now()) ? record : null;
  }

  return {
    async create(input: CreateSessionInput): Promise<CreatedSession> {
      const createdAt = now();
      const expiresAt = input.expiresAt ?? new Date(createdAt.getTime() + sessionTtlMs);
      if (expiresAt <= createdAt) throw new Error('Session expiration must be in the future');

      const session = createOpaqueToken();
      const csrf = createOpaqueToken();
      const record = await store.create({
        id: session.hash,
        userId: input.userId,
        username: input.username,
        avatarHash: input.avatarHash ?? null,
        accessTokenEncrypted: encryptSecret(input.accessToken, options.encryptionKey),
        refreshTokenEncrypted: input.refreshToken
          ? encryptSecret(input.refreshToken, options.encryptionKey)
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

    async resolve(sessionToken: string): Promise<PublicSession | null> {
      const record = await findActive(sessionToken);
      return record ? toPublicSession(record) : null;
    },

    async verifyCsrf(sessionToken: string, csrfToken: string): Promise<boolean> {
      const record = await findActive(sessionToken);
      return record ? verifyOpaqueToken(csrfToken, record.csrfTokenHash) : false;
    },

    async touch(sessionToken: string): Promise<PublicSession | null> {
      const touchedAt = now();
      const record = await store.touchActive(hashOpaqueToken(sessionToken), touchedAt);
      return record && isActive(record, touchedAt) ? toPublicSession(record) : null;
    },

    revoke(sessionToken: string): Promise<boolean> {
      return store.revokeActive(hashOpaqueToken(sessionToken), now());
    },

    async readOAuthTokens(sessionToken: string): Promise<OAuthSessionTokens | null> {
      const record = await findActive(sessionToken);
      if (!record) return null;
      return {
        accessToken: decryptSecret(record.accessTokenEncrypted, options.encryptionKey),
        refreshToken: record.refreshTokenEncrypted
          ? decryptSecret(record.refreshTokenEncrypted, options.encryptionKey)
          : null,
      };
    },

    replaceOAuthTokens(sessionToken: string, tokens: OAuthSessionTokens): Promise<boolean> {
      return store.updateTokensActive(hashOpaqueToken(sessionToken), {
        accessTokenEncrypted: encryptSecret(tokens.accessToken, options.encryptionKey),
        refreshTokenEncrypted: tokens.refreshToken
          ? encryptSecret(tokens.refreshToken, options.encryptionKey)
          : null,
      }, now());
    },
  };
}
