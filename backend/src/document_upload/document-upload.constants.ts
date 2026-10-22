/**
 * Constantes del modulo document_upload (RF-016, RNF-005).
 * Los codigos viajan en `extensions.code` de GraphQL o en el cuerpo de
 * error REST; `field` acompaña a errores de validacion.
 */

/** Extensiones de archivo aceptadas (según la extension del nombre original). */
export const ALLOWED_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg', 'xlsx'] as const;

/** Firma magica (Magic Number) de cada formato aceptado, en orden de byte. */
export const MAGIC_BYTES: Record<string, number[]> = {
  pdf: [0x25, 0x50, 0x44, 0x46, 0x2d], // %PDF-
  png: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], // \x89PNG\r\n\x1a\n
  jpg: [0xff, 0xd8, 0xff], // \xFF\xD8\xFF
  jpeg: [0xff, 0xd8, 0xff], // \xFF\xD8\xFF (mismo magico que jpg)
  xlsx: [0x50, 0x4b, 0x03, 0x04], // PK\x03\x04 (ZIP basado)
} as const;

/** Extension que reporta el detector de magico para cada firma encontrada. */
export const MAGIC_TO_EXTENSION: Record<string, string> = {
  pdf: 'pdf',
  png: 'png',
  jpg: 'jpg',
  jpeg: 'jpg', // el magico de jpg/jpeg es el mismo
  xlsx: 'xlsx',
};

/** Codigos de error de este modulo. */
export const DOCUMENT_ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNSUPPORTED_MEDIA_TYPE: 'UNSUPPORTED_MEDIA_TYPE',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  MALWARE_DETECTED: 'MALWARE_DETECTED',
  SCAN_UNAVAILABLE: 'SCAN_UNAVAILABLE',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
} as const;

/** Accion de auditoria al subir un documento de evidencia (RF-017). */
export function evidenceUploadAuditAction(docType: string): string {
  return `upload_evidence_document:${docType}`;
}

/** Mensaje de error por codigo (español). */
export function documentErrorMessage(code: string): string {
  switch (code) {
    case DOCUMENT_ERROR_CODES.UNSUPPORTED_MEDIA_TYPE:
      return 'Tipo de archivo no permitido. Formatos validos: PDF, PNG, JPG, XLSX.';
    case DOCUMENT_ERROR_CODES.PAYLOAD_TOO_LARGE:
      return 'El archivo excede los 25 MB permitidos.';
    case DOCUMENT_ERROR_CODES.MALWARE_DETECTED:
      return 'El archivo fue rechazado por el analisis antivirus.';
    case DOCUMENT_ERROR_CODES.SCAN_UNAVAILABLE:
      return 'El servicio de analisis antivirus no esta disponible. Intenta de nuevo.';
    case DOCUMENT_ERROR_CODES.CONFLICT:
      return 'Ya existe un documento de evidencia con este nombre para el proyecto.';
    default:
      return 'Error de validacion del archivo.';
  }
}
