import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { prisma } from '../db/prisma.js';
import type { DocType } from '../generated/prisma/client.js';
import type { AuthenticatedUser } from '../projects/session.guard.js';
import {
  OPEN_PROJECT_STATUSES,
} from '../projects/projects.constants.js';
import { assertProjectWritable } from '../projects/project-write-guard.js';
import {
  DOCUMENT_ERROR_CODES,
  documentErrorMessage,
  evidenceUploadAuditAction,
} from './document-upload.constants.js';
import {
  checkProjectQuota,
  detectFileType,
  extractFileExtension,
  validateEvidenceUpload,
} from './document-upload.policy.js';
import { requiresAnonymizationCertification } from '../projects/project-ethics.policy.js';
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

export interface UploadEvidenceOptions {
  /** RF-006: vincula la evidencia a un hito en la misma transaccion. */
  milestoneId?: number;
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
 * 6. Escribe en UPLOAD_DIR y, en una transaccion, crea ProjectDocument
 *    (evidence, Team_only), lo vincula al hito si aplica y registra la
 *    auditoria (RF-017). Si el INSERT falla, se borra el archivo.
 *
 * Solo miembros del equipo pueden subir (no requiere ser PI, a diferencia
 * de los documentos obligatorios en projects.service.ts).
 */
export async function uploadEvidenceDocument(
  user: AuthenticatedUser,
  projectId: number,
  file: UploadedFile,
  ip: string,
  options: UploadEvidenceOptions = {},
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
  // RF-020: un proyecto archivado no admite nuevas evidencias.
  assertProjectWritable(project as { is_read_only?: boolean | null });
  if (
    !(OPEN_PROJECT_STATUSES as readonly string[]).includes(
      (project as { status: string }).status,
    )
  ) {
    fail(
      DOCUMENT_ERROR_CODES.CONFLICT,
      'El proyecto esta cerrado y no acepta documentos.',
      409,
    );
  }

  // 2b) F1-11 / BR-012: los datasets XLSX de proyectos con seres humanos
  // exigen que el PI haya certificado su anonimizacion.
  const extension = extractFileExtension(file.originalname);
  if (
    extension &&
    requiresAnonymizationCertification(
      project as {
        research_involves_humans: boolean;
        research_involves_animals: boolean;
        uses_sensitive_data: boolean;
        anonymization_certified: boolean;
      },
      extension,
    )
  ) {
    fail(
      DOCUMENT_ERROR_CODES.ANONYMIZATION_CERTIFICATION_REQUIRED,
      documentErrorMessage(
        DOCUMENT_ERROR_CODES.ANONYMIZATION_CERTIFICATION_REQUIRED,
      ),
      409,
      'file',
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
    // 6-7) Documento + vinculo al hito + auditoria en una sola transaccion:
    // un fallo intermedio revierte todo y no deja estados inconsistentes.
    const created = (await prisma.$transaction(async (tx) => {
      const document = await tx.projectDocument.create({
        data: {
          project_id: projectId,
          doc_type: 'evidence' as DocType,
          visibility: 'Team_only',
          file_url: absolutePath.split(sep).join('/'),
          version: 1,
          file_name: file.originalname,
          file_size: file.size,
          ...(options.milestoneId !== undefined
            ? { milestone_id: options.milestoneId }
            : {}),
        },
      });

      // 7) Auditoria (RF-017).
      await tx.audit_Log.create({
        data: {
          actor_id: user.id,
          action: evidenceUploadAuditAction(detected),
          target_id: String(projectId),
          source_ip: ip,
        },
      });

      return document;
    })) as unknown as UploadEvidenceResult;

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
