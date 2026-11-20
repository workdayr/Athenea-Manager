/**
 * Operaciones de subida de documentos de evidencia.
 * Reutilizan el transporte same-origin `/api/*` (ver next.config.ts) y
 * el token Bearer de `localStorage['bearer_token']`.
 *
 * GraphQL no transporta multipart, por tanto este endpoint es REST.
 */

/** Extensiones aceptadas (coherente con el backend). */
export const ALLOWED_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg', 'xlsx'] as const;

/** Tamaño máximo por archivo (25 MB). */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

/** Códigos de error que puede devolver el backend. */
export const UPLOAD_ERROR_CODES = {
  MALWARE_DETECTED: 'MALWARE_DETECTED',
  SCAN_UNAVAILABLE: 'SCAN_UNAVAILABLE',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  UNSUPPORTED_MEDIA_TYPE: 'UNSUPPORTED_MEDIA_TYPE',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
} as const;

export interface UploadEvidenceResult {
  document_id: number;
  project_id: number;
  doc_type: string;
  visibility: string;
  file_url: string;
  version: number;
  file_name: string | null;
  file_size: number | null;
  uploaded_at: string;
}

/**
 * Sube un archivo de evidencia a un proyecto.
 * Lanza Error con `message` legible en español para la UI.
 */
export async function uploadEvidenceDocument(
  projectId: number,
  file: File,
): Promise<UploadEvidenceResult> {
  // Validacion rapida en cliente (feedback inmediato, no reemplaza al backend).
  const ext = file.name.slice(file.name.lastIndexOf('.') + 1).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext as (typeof ALLOWED_EXTENSIONS)[number])) {
    throw new Error(
      `Extension no permitida: ${ext}. Validas: ${ALLOWED_EXTENSIONS.join(', ')}.`,
    );
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(
      `El archivo excede los 25 MB permitidos (${Math.round(file.size / 1024 / 1024)} MB).`,
    );
  }

  const form = new FormData();
  form.append('file', file);

  const token =
    typeof window !== 'undefined'
      ? window.localStorage.getItem('bearer_token') ?? ''
      : '';

  const response = await fetch(`/api/projects/${projectId}/evidence`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: form,
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { message?: string }
      | null;
    const message = body?.message || `Error HTTP ${response.status}`;
    throw new Error(message);
  }

  return (await response.json()) as UploadEvidenceResult;
}

/** Mensaje legible para cada codigo de error del backend. */
export function uploadErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return 'No se pudo subir el archivo. Intenta de nuevo.';
}
