export declare function parseEncryptionKey(value: string): Buffer;
export declare function encryptSecret(plaintext: string, encryptionKey: string): string;
export declare function decryptSecret(serialized: string, encryptionKey: string): string;
export declare function hashOpaqueToken(token: string): string;
export interface OpaqueToken {
    token: string;
    hash: string;
}
export declare function createOpaqueToken(): OpaqueToken;
export declare function verifyOpaqueToken(token: string, expectedHash: string): boolean;
//# sourceMappingURL=crypto.d.ts.map