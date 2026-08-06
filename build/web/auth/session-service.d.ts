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
export type SessionStoreCreateInput = Omit<SessionRecord, 'criadoEm' | 'atualizadoEm' | 'ultimoAcessoEm' | 'revogadoEm'>;
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
    deleteExpiredOrRevoked(at: Date): Promise<number>;
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
export declare function createSessionService(options: SessionServiceOptions): {
    create(input: CreateSessionInput): Promise<CreatedSession>;
    resolve(sessionToken: string): Promise<PublicSession | null>;
    verifyCsrf(sessionToken: string, csrfToken: string): Promise<boolean>;
    touch(sessionToken: string): Promise<PublicSession | null>;
    revoke(sessionToken: string): Promise<boolean>;
    readOAuthTokens(sessionToken: string): Promise<OAuthSessionTokens | null>;
    replaceOAuthTokens(sessionToken: string, tokens: OAuthSessionTokens): Promise<boolean>;
};
//# sourceMappingURL=session-service.d.ts.map