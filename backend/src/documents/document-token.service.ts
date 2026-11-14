import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * F1-05 / RNF-005: generacion y validacion de tokens firmados HMAC para descarga de documentos.
 */

export const DOWNLOAD_TOKEN_EXPIRATION_SECONDS = 5 * 60; // 5 minutos

function getSecretKey(): string {
  return (
    process.env['DOWNLOAD_SECRET_KEY'] ??
    process.env['BETTER_AUTH_SECRET'] ??
    'fallback-download-secret-key-32chars-min!'
  );
}

export interface DownloadTokenPayload {
  documentId: number;
  userId: string;
  expiresAt: number;
}

export function generateDownloadToken(
  documentId: number,
  userId: string,
  expiresInSeconds: number = DOWNLOAD_TOKEN_EXPIRATION_SECONDS,
): { token: string; expiresAt: Date } {
  const expiresAtMs = Date.now() + expiresInSeconds * 1000;
  const data = `${documentId}:${userId}:${expiresAtMs}`;
  const hmac = createHmac('sha256', getSecretKey()).update(data).digest('hex');
  const token = Buffer.from(`${data}:${hmac}`).toString('base64url');
  return {
    token,
    expiresAt: new Date(expiresAtMs),
  };
}

export function verifyDownloadToken(
  token: string,
  expectedDocumentId?: number,
): { valid: boolean; expired: boolean; payload?: DownloadTokenPayload; reason?: string } {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const parts = decoded.split(':');
    if (parts.length !== 4) {
      return { valid: false, expired: false, reason: 'Formato de token invalido' };
    }

    const [docIdStr, userId, expiresAtStr, signature] = parts;
    const documentId = parseInt(docIdStr!, 10);
    const expiresAt = parseInt(expiresAtStr!, 10);

    if (isNaN(documentId) || isNaN(expiresAt) || !userId || !signature) {
      return { valid: false, expired: false, reason: 'Valores de token corruptos' };
    }

    if (expectedDocumentId !== undefined && documentId !== expectedDocumentId) {
      return { valid: false, expired: false, reason: 'El token no corresponde a este documento' };
    }

    const data = `${documentId}:${userId}:${expiresAt}`;
    const expectedSignature = createHmac('sha256', getSecretKey())
      .update(data)
      .digest('hex');

    const sigBuffer = Buffer.from(signature, 'utf8');
    const expBuffer = Buffer.from(expectedSignature, 'utf8');

    if (sigBuffer.length !== expBuffer.length || !timingSafeEqual(sigBuffer, expBuffer)) {
      return { valid: false, expired: false, reason: 'Firma HMAC invalida' };
    }

    if (Date.now() > expiresAt) {
      return {
        valid: false,
        expired: true,
        payload: { documentId, userId, expiresAt },
        reason: 'El token de descarga ha expirado (RNF-005)',
      };
    }

    return {
      valid: true,
      expired: false,
      payload: { documentId, userId, expiresAt },
    };
  } catch {
    return { valid: false, expired: false, reason: 'Error al decodificar token' };
  }
}
