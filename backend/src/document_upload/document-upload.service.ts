import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { prisma } from '../db/prisma.js';
import type { DocType } from '../generated/prisma/client.js';
import type { AuthenticatedUser } from '../projects/session.guard.js';
import {
  ACTIVE_PROJECT_STATUSES,
} from '../projects/projects.constants.js';
import {
  DOCUMENT_ERROR_CODES,
  documentErrorMessage,
  evidenceUploadAuditAction,
} from './document-upload.constants.js';
import {
  checkProjectQuota,
  detectFileType,
  validateEvidenceUpload,
} from './document-upload.policy.js';
import { antivirus } from './antivirus.service.js';

/** Error de dominio: se mapea a HTTP (DocumentsController) o GraphQL. */
export class DocumentUploadError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly httpStatus: number,
    readonly field?: string,
  ) {
    super(message);
  }
}

export interface UploadedFile {
  buffer: Buffer;
  originalname: string;
  size: number;
}

export interface UploadEvidenceResult {
  document_id: number;
  project_id: number;
  doc_type: string;
  visibility: string;
  file_url: string;
  version: number;
  file_name: string | null;
  file_size: number | null;
  uploaded_at: Date;
}

function uploadBaseDir(): string {
  return resolve(process.env['UPLOAD_DIR'] ?? join(process.cwd(), 'uploads'));
}

function fail(
  code: string,
  message: string,
  httpStatus: number,
  field?: string,
): never {
  throw new DocumentUploadError(code, message, httpStatus, field);
}

/**
 * RF-016 + RNF-005: sube un archivo de evidencia de trabajo a un proyecto.
 *
 * Pasos (orden critico: el antivirus se ejecuta ANTES de escribir en disco,
 * y nada se guarda si el escaneo falla o detecta malware - F-05):
 * 1. El usuario es miembro del equipo del proyecto (cualquier rol).
 * 2. El proyecto existe y esta en estado abierto (no cerrado).
 * 3. Validacion por Magic Numbers + extension + 25 MB.
 * 4. Cuota de 500 MB por proyecto.
 * 5. Escaneo antivirus (clamd). Si infectado o no disponible -> 422/503.
 * 6. Escribe en UPLOAD_DIR y crea ProjectDocument (evidence, Team_only).
 * 7. Registra en Audit_Log (RF-017).
 *
 * Solo miembros del equipo pueden subir (no requiere ser PI, a diferencia
 * de los documentos obligatorios en projects.service.ts).
 */
export async function uploadEvidenceDocument(
  user: AuthenticatedUser,
  projectId: number,
  file: UploadedFile,
  ip: string,
): Promise<UploadEvidenceResult> {
  // 1) Membresia en el equipo (defensa en profundidad: el controller no usa @Roles).
  const membership = await prisma.project_User.findFirst({
    where: {
      project_id: projectId,
      user_id: user.id,
    },
  });
  if (!membership) {
    fail(
      DOCUMENT_ERROR_CODES.FORBIDDEN,
      'Solo los miembros del equipo del proyecto pueden subir evidencia.',
      403,
    );
  }

  // 2) Proyecto existe y esta abierto (no cerrado).
  const project = await prisma.project.findUnique({
    where: { project_id: projectId },
  });
  if (!project) {
    fail(DOCUMENT_ERROR_CODES.NOT_FOUND, 'El proyecto no existe.', 404);
  }
  if (
    !(ACTIVE_PROJECT_STATUSES as readonly string[]).includes(
      (project as { status: string }).status,
    )
  ) {
    fail(
      DOCUMENT_ERROR_CODES.CONFLICT,
      'El proyecto esta cerrado y no acepta documentos.',
      409,
    );
  }

  // 3) Validacion por Magic Numbers, extension y tamano.
  const issues = validateEvidenceUpload(file);
  if (issues.length > 0) {
    const first = issues[0];
    fail(
      first.code,
      documentErrorMessage(first.code) + ' ' + first.message,
      first.httpStatus,
      first.field,
    );
  }

  // 4) Cuota de 500 MB por proyecto (documentos de registro + evidencia compartida).
  const aggregate = await prisma.projectDocument.aggregate({
    where: { project_id: projectId },
    _sum: { file_size: true },
  });
  const quotaIssue = checkProjectQuota(
    aggregate._sum.file_size ?? 0,
    file.size,
  );
  if (quotaIssue) {
    fail(
      quotaIssue.code,
      documentErrorMessage(quotaIssue.code) + ' ' + quotaIssue.message,
      quotaIssue.httpStatus,
      quotaIssue.field,
    );
  }

  // 5) Escaneo antivirus ANTES de escribir en disco (F-05: fail closed).
  const scanResult = await antivirus.scan(file.buffer);
  if (scanResult === 'infected') {
    fail(
      DOCUMENT_ERROR_CODES.MALWARE_DETECTED,
      'El archivo contiene malware y no puede guardarse.',
      422,
      'file',
    );
  }
  if (scanResult === 'unavailable') {
    fail(
      DOCUMENT_ERROR_CODES.SCAN_UNAVAILABLE,
      'El servicio de analisis antivirus no esta disponible.',
      503,
      'file',
    );
  }

  // 6) Escribe en disco y crea el registro (si falla el INSERT, se borra el archivo).
  const detected = detectFileType(file.buffer)!;
  const dir = join(uploadBaseDir(), 'projects', String(projectId));
  await mkdir(dir, { recursive: true });
  const fileName = `${detected}_evidence_${Date.now()}.${detected}`;
  const absolutePath = join(dir, fileName);
  await writeFile(absolutePath, file.buffer);

  try {
    const created = (await prisma.projectDocument.create({
      data: {
        project_id: projectId,
        doc_type: 'evidence' as DocType,
        visibility: 'Team_only',
        file_url: absolutePath.split(sep).join('/'),
        version: 1,
        file_name: file.originalname,
        file_size: file.size,
      },
    })) as unknown as UploadEvidenceResult;

    // 7) Auditoria (RF-017).
    await prisma.audit_Log.create({
      data: {
        actor_id: user.id,
        action: evidenceUploadAuditAction(detected),
        target_id: String(projectId),
        source_ip: ip,
      },
    });

    return {
      document_id: created.document_id,
      project_id: created.project_id,
      doc_type: created.doc_type,
      visibility: created.visibility,
      file_url: created.file_url,
      version: created.version,
      file_name: created.file_name,
      file_size: created.file_size,
      uploaded_at: created.uploaded_at,
    };
  } catch (error) {
    await unlink(absolutePath).catch(() => undefined);
    throw error;
  }
}
