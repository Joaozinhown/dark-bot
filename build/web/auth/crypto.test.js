"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = __importDefault(require("node:test"));
const crypto_1 = require("./crypto");
const KEY = Buffer.alloc(32, 7).toString('base64');
(0, node_test_1.default)('accepts only canonical base64 keys containing exactly 32 bytes', () => {
    strict_1.default.equal((0, crypto_1.parseEncryptionKey)(KEY).byteLength, 32);
    for (const invalid of ['', 'not-base64', Buffer.alloc(31).toString('base64'), `${KEY}\n`]) {
        strict_1.default.throws(() => (0, crypto_1.parseEncryptionKey)(invalid), /32-byte base64/i);
    }
});
(0, node_test_1.default)('encrypts OAuth secrets with authenticated randomized AES-256-GCM', () => {
    const first = (0, crypto_1.encryptSecret)('oauth-access-token', KEY);
    const second = (0, crypto_1.encryptSecret)('oauth-access-token', KEY);
    strict_1.default.notEqual(first, second);
    strict_1.default.equal(first.includes('oauth-access-token'), false);
    strict_1.default.equal((0, crypto_1.decryptSecret)(first, KEY), 'oauth-access-token');
    strict_1.default.throws(() => (0, crypto_1.decryptSecret)(first, Buffer.alloc(32, 9).toString('base64')));
    const tampered = `${first.slice(0, -1)}${first.endsWith('A') ? 'B' : 'A'}`;
    strict_1.default.throws(() => (0, crypto_1.decryptSecret)(tampered, KEY));
});
(0, node_test_1.default)('creates opaque random values whose stored representation is SHA-256', () => {
    const first = (0, crypto_1.createOpaqueToken)();
    const second = (0, crypto_1.createOpaqueToken)();
    strict_1.default.notEqual(first.token, second.token);
    strict_1.default.match(first.hash, /^[a-f0-9]{64}$/);
    strict_1.default.equal((0, crypto_1.verifyOpaqueToken)(first.token, first.hash), true);
    strict_1.default.equal((0, crypto_1.verifyOpaqueToken)(second.token, first.hash), false);
    strict_1.default.equal((0, crypto_1.verifyOpaqueToken)(first.token, 'invalid'), false);
});
//# sourceMappingURL=crypto.test.js.map