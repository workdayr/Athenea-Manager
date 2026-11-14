import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * F1-08 / RNF-001: cifrado en reposo con AES-256-GCM.
 *
 * Servicio utilitario para campos sensibles (p. ej. datos de sujetos
 * humanos o licencias profesionales cuando se confirmen). La clave se toma
 * de `DATA_ENCRYPTION_KEY` (32 bytes en hex o base64); si no esta definida,
 * el servicio falla de forma cerrada (fail-closed) y no se almacena nada
 * en claro por error.
 *
 * Formato del texto cifrado: `v1:<iv b64>:<tag b64>:<ciphertext b64>`.
 * La version (`v1`) permite rotar el algoritmo sin romper datos existentes.
 */

export const CRYPTO_ALGORITHM = 'aes-256-gcm';
export const CRYPTO_IV_BYTES = 12;
export const CRYPTO_TAG_BYTES = 16;
export const CRYPTO_KEY_BYTES = 32;

export class CryptoConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CryptoConfigurationError';
  }
}

export class CryptoDecryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CryptoDecryptionError';
  }
}

function readKey(): Buffer {
  const raw = process.env['DATA_ENCRYPTION_KEY'];
  if (!raw || raw.trim().length === 0) {
    throw new CryptoConfigurationError(
      'DATA_ENCRYPTION_KEY no esta definida; el cifrado en reposo no esta disponible (RNF-001).',
    );
  }
  const trimmed = raw.trim();
  // Hex (64 caracteres) o base64 (44 caracteres con padding).
  let key: Buffer;
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    key = Buffer.from(trimmed, 'hex');
  } else {
    key = Buffer.from(trimmed, 'base64');
  }
  if (key.length !== CRYPTO_KEY_BYTES) {
    throw new CryptoConfigurationError(
      `DATA_ENCRYPTION_KEY debe codificar ${CRYPTO_KEY_BYTES} bytes (hex de 64 caracteres o base64 de 44).`,
    );
  }
  return key;
}

/** Indica si el cifrado esta configurado (sin lanzar). */
export function isEncryptionConfigured(): boolean {
  try {
    readKey();
    return true;
  } catch {
    return false;
  }
}

/** Cifra un texto y devuelve la representacion versionada. */
export function encrypt(plaintext: string): string {
  const key = readKey();
  const iv = randomBytes(CRYPTO_IV_BYTES);
  const cipher = createCipheriv(CRYPTO_ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    'v1',
    iv.toString('base64'),
    tag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':');
}

/** Descifra una representacion versionada. Lanza si el formato o el tag son invalidos. */
export function decrypt(ciphertext: string): string {
  const parts = ciphertext.split(':');
  if (parts.length !== 4 || parts[0] !== 'v1') {
    throw new CryptoDecryptionError(
      'Formato de texto cifrado invalido o version no soportada.',
    );
  }
  const key = readKey();
  let iv: Buffer;
  let tag: Buffer;
  let encrypted: Buffer;
  try {
    iv = Buffer.from(parts[1], 'base64');
    tag = Buffer.from(parts[2], 'base64');
    encrypted = Buffer.from(parts[3], 'base64');
  } catch {
    throw new CryptoDecryptionError('Texto cifrado corrupto (base64 invalido).');
  }
  if (iv.length !== CRYPTO_IV_BYTES || tag.length !== CRYPTO_TAG_BYTES) {
    throw new CryptoDecryptionError('IV o tag con longitud incorrecta.');
  }
  const decipher = createDecipheriv(CRYPTO_ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  try {
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  } catch {
    throw new CryptoDecryptionError(
      'No se pudo descifrar: clave incorrecta o datos manipulados (RNF-001).',
    );
  }
}