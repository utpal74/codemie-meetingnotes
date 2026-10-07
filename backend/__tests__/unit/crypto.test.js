// testEnv.js sets PHONE_ENCRYPTION_KEY and PHONE_HMAC_SECRET before this runs
const { encryptPhone, decryptPhone, hashPhone } = require('../../src/helpers/crypto');

describe('crypto helpers', () => {
  const PHONE = '9876543210';

  describe('encryptPhone / decryptPhone', () => {
    test('round-trip returns original plaintext', () => {
      expect(decryptPhone(encryptPhone(PHONE))).toBe(PHONE);
    });

    test('two encryptions of same input produce different ciphertexts (random IV)', () => {
      const c1 = encryptPhone(PHONE);
      const c2 = encryptPhone(PHONE);
      expect(c1).not.toBe(c2);
    });

    test('ciphertext is in iv:authTag:encrypted format (3 colon-separated hex parts)', () => {
      const cipher = encryptPhone(PHONE);
      const parts = cipher.split(':');
      expect(parts).toHaveLength(3);
      parts.forEach(p => expect(p).toMatch(/^[0-9a-f]+$/i));
    });

    test('decrypting a tampered ciphertext throws', () => {
      const cipher = encryptPhone(PHONE);
      const parts = cipher.split(':');
      parts[2] = 'deadbeef'; // corrupt the ciphertext
      expect(() => decryptPhone(parts.join(':'))).toThrow();
    });

    test('decrypting a string with wrong part count throws', () => {
      expect(() => decryptPhone('bad:format')).toThrow('Invalid ciphertext format');
    });
  });

  describe('hashPhone', () => {
    test('same input always produces same hash', () => {
      expect(hashPhone(PHONE)).toBe(hashPhone(PHONE));
    });

    test('different inputs produce different hashes', () => {
      expect(hashPhone('9876543210')).not.toBe(hashPhone('9876543211'));
    });

    test('hash is a 64-char hex string (SHA-256 HMAC)', () => {
      expect(hashPhone(PHONE)).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe('missing env vars', () => {
    const originalKey = process.env.PHONE_ENCRYPTION_KEY;
    const originalSecret = process.env.PHONE_HMAC_SECRET;

    afterEach(() => {
      process.env.PHONE_ENCRYPTION_KEY = originalKey;
      process.env.PHONE_HMAC_SECRET = originalSecret;
    });

    test('encryptPhone throws when PHONE_ENCRYPTION_KEY is missing', () => {
      delete process.env.PHONE_ENCRYPTION_KEY;
      expect(() => encryptPhone(PHONE)).toThrow('PHONE_ENCRYPTION_KEY');
    });

    test('hashPhone throws when PHONE_HMAC_SECRET is missing', () => {
      delete process.env.PHONE_HMAC_SECRET;
      expect(() => hashPhone(PHONE)).toThrow('PHONE_HMAC_SECRET');
    });
  });
});
