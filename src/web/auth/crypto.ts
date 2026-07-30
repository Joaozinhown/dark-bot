import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

const AES_KEY_BYTES = 32;
const GCM_IV_BYTES = 12;
const GCM_TAG_BYTES = 16;
const OPAQUE_TOKEN_BYTES = 32;
const CIPHERTEXT_VERSION = 'v1';

function decodeBase64Url(value: string, expectedBytes: number): Buffer {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error('Encrypted secret has an invalid format');
  }

  const decoded = Buffer.from(value, 'base64url');
  if (decoded.byteLength !== expectedBytes || decoded.toString('base64url') !== value) {
    throw new Error('Encrypted secret has an invalid format');
  }
  return decoded;
}

export function parseEncryptionKey(value: string): Buffer {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value) || value.length % 4 !== 0) {
    throw new Error('OAuth encryption key must be a canonical 32-byte base64 value');
  }

  const key = Buffer.from(value, 'base64');
  if (key.byteLength !== AES_KEY_BYTES || key.toString('base64') !== value) {
    throw new Error('OAuth encryption key must be a canonical 32-byte base64 value');
  }
  return key;
}

export function encryptSecret(plaintext: string, encryptionKey: string): string {
  const key = parseEncryptionKey(encryptionKey);
  const iv = randomBytes(GCM_IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    CIPHERTEXT_VERSION,
    iv.toString('base64url'),
    ciphertext.toString('base64url'),
    tag.toString('base64url'),
  ].join('.');
}

export function decryptSecret(serialized: string, encryptionKey: string): string {
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

  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

export function hashOpaqueToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export interface OpaqueToken {
  token: string;
  hash: string;
}

export function createOpaqueToken(): OpaqueToken {
  const token = randomBytes(OPAQUE_TOKEN_BYTES).toString('base64url');
  return { token, hash: hashOpaqueToken(token) };
}

export function verifyOpaqueToken(token: string, expectedHash: string): boolean {
  if (!/^[a-f0-9]{64}$/.test(expectedHash)) return false;

  const actual = Buffer.from(hashOpaqueToken(token), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return timingSafeEqual(actual, expected);
}
