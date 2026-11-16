import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CRYPTO_KEY_BYTES,
  CryptoConfigurationError,
  CryptoDecryptionError,
  decrypt,
  encrypt,
  isEncryptionConfigured,
} from './crypto.service.js';

const HEX_KEY = '0'.repeat(64);
const TEXT = 'licencia-profesional-12345 / datos sensibles de sujetos humanos';

describe('crypto.service (F1-08 / RNF-001)', () => {
  beforeEach(() => {
    process.env['DATA_ENCRYPTION_KEY'] = HEX_KEY;
  });
  afterEach(() => {
    delete process.env['DATA_ENCRYPTION_KEY'];
  });

  it('cifra y descifra de forma simetrica', () => {
    const cipher = encrypt(TEXT);
    expect(cipher).not.toBe(TEXT);
    expect(cipher.startsWith('v1:')).toBe(true);
    expect(decrypt(cipher)).toBe(TEXT);
  });

  it('genera IV aleatorio (no determinista)', () => {
    const a = encrypt(TEXT);
    const b = encrypt(TEXT);
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe(TEXT);
    expect(decrypt(b)).toBe(TEXT);
  });

  it('rechaza datos manipulados (tag invalido)', () => {
    const cipher = encrypt(TEXT);
    const parts = cipher.split(':');
    // Alterar el ciphertext.
    const tampered = Buffer.from(parts[3], 'base64');
    tampered[0] ^= 0xff;
    parts[3] = tampered.toString('base64');
    expect(() => decrypt(parts.join(':'))).toThrow(CryptoDecryptionError);
  });

  it('rechaza formato o version no soportada', () => {
    expect(() => decrypt('v2:aaaa:bbbb:cccc')).toThrow(CryptoDecryptionError);
    expect(() => decrypt('sin-formato')).toThrow(CryptoDecryptionError);
  });

  it('falla cerrado sin clave configurada', () => {
    delete process.env['DATA_ENCRYPTION_KEY'];
    expect(isEncryptionConfigured()).toBe(false);
    expect(() => encrypt(TEXT)).toThrow(CryptoConfigurationError);
  });

  it('acepta clave en base64', () => {
    const base64Key = Buffer.alloc(CRYPTO_KEY_BYTES, 7).toString('base64');
    process.env['DATA_ENCRYPTION_KEY'] = base64Key;
    expect(isEncryptionConfigured()).toBe(true);
    const cipher = encrypt(TEXT);
    expect(decrypt(cipher)).toBe(TEXT);
  });

  it('rechaza clave con longitud incorrecta', () => {
    process.env['DATA_ENCRYPTION_KEY'] = 'abcd';
    expect(isEncryptionConfigured()).toBe(false);
    expect(() => encrypt(TEXT)).toThrow(CryptoConfigurationError);
  });
});
