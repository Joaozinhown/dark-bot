"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseEncryptionKey = parseEncryptionKey;
exports.encryptSecret = encryptSecret;
exports.decryptSecret = decryptSecret;
exports.hashOpaqueToken = hashOpaqueToken;
exports.createOpaqueToken = createOpaqueToken;
exports.verifyOpaqueToken = verifyOpaqueToken;
const node_crypto_1 = require("node:crypto");
const AES_KEY_BYTES = 32;
const GCM_IV_BYTES = 12;
const GCM_TAG_BYTES = 16;
const OPAQUE_TOKEN_BYTES = 32;
const CIPHERTEXT_VERSION = 'v1';
function decodeBase64Url(value, expectedBytes) {
    if (!/^[A-Za-z0-9_-]+$/.test(value)) {
        throw new Error('Encrypted secret has an invalid format');
    }
    const decoded = Buffer.from(value, 'base64url');
    if (decoded.byteLength !== expectedBytes || decoded.toString('base64url') !== value) {
        throw new Error('Encrypted secret has an invalid format');
    }
    return decoded;
}
function parseEncryptionKey(value) {
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value) || value.length % 4 !== 0) {
        throw new Error('OAuth encryption key must be a canonical 32-byte base64 value');
    }
    const key = Buffer.from(value, 'base64');
    if (key.byteLength !== AES_KEY_BYTES || key.toString('base64') !== value) {
        throw new Error('OAuth encryption key must be a canonical 32-byte base64 value');
    }
    return key;
}
function encryptSecret(plaintext, encryptionKey) {
    const key = parseEncryptionKey(encryptionKey);
    const iv = (0, node_crypto_1.randomBytes)(GCM_IV_BYTES);
    const cipher = (0, node_crypto_1.createCipheriv)('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [
        CIPHERTEXT_VERSION,
        iv.toString('base64url'),
        ciphertext.toString('base64url'),
        tag.toString('base64url'),
    ].join('.');
}
function decryptSecret(serialized, encryptionKey) {
    const key = parseEncryptionKey(encryptionKey);
    const [version, encodedIv, encodedCiphertext, encodedTag, extra] = serialized.split('.');
    if (version !== CIPHERTEXT_VERSION || !encodedIv || !encodedCiphertext || !encodedTag || extra) {
        throw new Error('Encrypted secret has an invalid format');
    }
    const iv = decodeBase64Url(encodedIv, GCM_IV_BYTES);
    const tag = decodeBase64Url(encodedTag, GCM_TAG_BYTES);
    const ciphertext = Buffer.from(encodedCiphertext, 'base64url');
    if (ciphertext.toString('base64url') !== encodedCiphertext) {
        throw new Error('Encrypted secret has an invalid format');
    }
    const decipher = (0, node_crypto_1.createDecipheriv)('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
function hashOpaqueToken(token) {
    return (0, node_crypto_1.createHash)('sha256').update(token, 'utf8').digest('hex');
}
function createOpaqueToken() {
    const token = (0, node_crypto_1.randomBytes)(OPAQUE_TOKEN_BYTES).toString('base64url');
    return { token, hash: hashOpaqueToken(token) };
}
function verifyOpaqueToken(token, expectedHash) {
    if (!/^[a-f0-9]{64}$/.test(expectedHash))
        return false;
    const actual = Buffer.from(hashOpaqueToken(token), 'hex');
    const expected = Buffer.from(expectedHash, 'hex');
    return (0, node_crypto_1.timingSafeEqual)(actual, expected);
}
//# sourceMappingURL=crypto.js.map