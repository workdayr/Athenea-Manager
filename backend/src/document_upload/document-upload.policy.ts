/**
 * Reglas puras del modulo document_upload (RF-016, RNF-005). Sin E/S:
 * toda la logica testeable vive aqui; el servicio solo orquesta Prisma,
 * el antivirus y el almacenamiento de archivos.
 *
 * La validacion se hace en dos capas independientes que DEBEN coincidir:
 * 1) la extension del nombre original (lo que el usuario envia), y
 * 2) la firma magica del contenido (lo que realmente es el archivo).
 * Si difieren, se rechaza: el usuario no puede disfrazar un ejecutable
 * con extension de imagen o documento.
 */

import {
  ALLOWED_EXTENSIONS,
  DOCUMENT_ERROR_CODES,
  MAGIC_BYTES,
  MAGIC_TO_EXTENSION,
} from './document-upload.constants.js';
import { MAX_FILE_BYTES, PROJECT_QUOTA_BYTES } from '../projects/projects.constants.js';

/**
 * Extension en minusculas de un nombre de archivo, sin el punto.
 * Devuelve null si no tiene extension.
 */
export function extractFileExtension(originalname: string): string | null {
  const lastDot = originalname.lastIndexOf('.');
  if (lastDot <= 0 || lastDot === originalname.length - 1) {
    return null;
  }
  return originalname.slice(lastDot + 1).toLowerCase();
}

/**
 * Detecta el tipo de archivo por su Magic Number (firma magica).
 * Devuelve la extension detectada (pdf/png/jpg/xlsx) o null si no
 * coincide con ninguno de los formatos permitidos.
 */
export function detectFileType(buffer: Buffer): string | null {
  for (const [extension, magic] of Object.entries(MAGIC_BYTES)) {
    if (
      buffer.length >= magic.length &&
      magic.every((byte, index) => buffer[index] === byte)
    ) {
      return extension;
    }
  }
  return null;
}

/**
 * Problema de validacion de un archivo a subir.
 */
export interface UploadValidationIssue {
  field: string;
  message: string;
  httpStatus: number;
  code: string;
}

/**
 * Valida un archivo candidato a subida (RF-016 + RNF-005):
 * - extension permitida
 * - magic number coincide con la extension (no se aceptan fraudes)
 * - tamano <= 25 MB
 * Devuelve los problemas encontrados (vacio = valido).
 */
export function validateEvidenceUpload(file: {
  buffer: Buffer;
  originalname: string;
  size: number;
}): UploadValidationIssue[] {
  const issues: UploadValidationIssue[] = [];
  const ext = extractFileExtension(file.originalname);

  if (!ext || !ALLOWED_EXTENSIONS.includes(ext as (typeof ALLOWED_EXTENSIONS)[number])) {
    issues.push({
      field: 'file',
      message: `Extension no permitida: '${ext ?? 'sin extension'}'. Validas: ${ALLOWED_EXTENSIONS.join(', ')}.`,
      httpStatus: 415,
      code: DOCUMENT_ERROR_CODES.UNSUPPORTED_MEDIA_TYPE,
    });
    return issues; // sin extension valida no se puede verificar el magico
  }

  const detected = detectFileType(file.buffer);
  const expected = MAGIC_TO_EXTENSION[ext];
  if (!detected || detected !== expected) {
    issues.push({
      field: 'file',
      message: `El contenido del archivo no coincide con su extension (${ext}). Se detecto: ${detected ?? 'ningun formato valido'}.`,
      httpStatus: 415,
      code: DOCUMENT_ERROR_CODES.UNSUPPORTED_MEDIA_TYPE,
    });
  }

  if (file.size > MAX_FILE_BYTES) {
    issues.push({
      field: 'file',
      message: `El archivo excede los 25 MB permitidos (${Math.round(file.size / 1024 / 1024)} MB).`,
      httpStatus: 413,
      code: DOCUMENT_ERROR_CODES.PAYLOAD_TOO_LARGE,
    });
  }

  return issues;
}

/**
 * Valida que agregar un archivo no supere la cuota de 500 MB del proyecto.
 */
export function checkProjectQuota(
  currentSum: number,
  newFileSize: number,
): UploadValidationIssue | null {
  if (currentSum + newFileSize > PROJECT_QUOTA_BYTES) {
    return {
      field: 'file',
      message: 'El proyecto excede la cuota de 500 MB de almacenamiento.',
      httpStatus: 413,
      code: DOCUMENT_ERROR_CODES.PAYLOAD_TOO_LARGE,
    };
  }
  return null;
}
