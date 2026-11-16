import { describe, expect, it } from 'vitest';
import {
  generateDownloadToken,
  verifyDownloadToken,
} from './document-token.service.js';

describe('DocumentTokenService (F1-05 / RNF-005)', () => {
  it('genera y verifica un token valido para el documento correcto', () => {
    const { token } = generateDownloadToken(55, 'u-user-1', 300);
    const result = verifyDownloadToken(token, 55);

    expect(result.valid).toBe(true);
    expect(result.expired).toBe(false);
    expect(result.payload?.documentId).toBe(55);
    expect(result.payload?.userId).toBe('u-user-1');
  });

  it('rechaza si se intenta usar el token en otro documentId', () => {
    const { token } = generateDownloadToken(55, 'u-user-1', 300);
    const result = verifyDownloadToken(token, 99);

    expect(result.valid).toBe(false);
    expect(result.reason).toContain('no corresponde');
  });

  it('detecta tokens expirados con flag expired=true', () => {
    // Generar con duracion negativa (-10s)
    const { token } = generateDownloadToken(55, 'u-user-1', -10);
    const result = verifyDownloadToken(token, 55);

    expect(result.valid).toBe(false);
    expect(result.expired).toBe(true);
    expect(result.reason).toContain('ha expirado');
  });

  it('rechaza tokens manipulados o alterados', () => {
    const { token } = generateDownloadToken(55, 'u-user-1', 300);
    const altered = token.slice(0, -4) + 'abcd';
    const result = verifyDownloadToken(altered, 55);

    expect(result.valid).toBe(false);
    expect(result.reason).toContain('invalida');
  });
});
