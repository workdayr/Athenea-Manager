import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { ROLES } from '../auth/roles.constants.js';
import { prisma } from '../db/prisma.js';
import { antivirus } from '../document_upload/antivirus.service.js';
import { isMandatoryReviewDocument } from '../documents/documents.policy.js';
import type { DocType } from '../generated/prisma/client.js';
import { notifyRole } from '../notifications/notifications.service.js';
import { applyStatusTransition } from '../projects/project-lifecycle.service.js';
import { MAX_FILE_BYTES } from '../projects/projects.constants.js';
import {
  exceedsProjectQuota,
  validatePdfUpload,
} from '../projects/projects.policy.js';
import { assertProjectWritable } from '../projects/project-write-guard.js';
import type { AuthenticatedUser } from '../projects/session.guard.js';
import {
  MAX_PROPOSAL_VERSIONS,
  PROPOSAL_VERSION_ERROR_CODES,
  proposalVersionUploadAuditAction,
} from './proposal-versions.constants.js';
import {
  canCreateProposalVersion,
  canViewProposalVersions,
  nextProposalVersionNumber,
  remainingProposalVersions,
  validateProposalDocumentTypes,
  validateProposalVersionInput,
} from './proposal-versions.policy.js';

export class ProposalVersionError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly httpStatus: number,
    readonly field?: string,
  ) {
    super(message);
  }
}

function fail(
  code: string,
  message: string,
  httpStatus: number,
  field?: string,
): never {
  throw new ProposalVersionError(code, message, httpStatus, field);
}

function uploadBaseDir(): string {
  return resolve(process.env['UPLOAD_DIR'] ?? join(process.cwd(), 'uploads'));
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: string }).code === 'P2002'
  );
}

async function removeFiles(paths: string[]): Promise<void> {
  await Promise.all(
    paths.map((path) => unlink(path).catch(() => undefined)),
  );
}

export interface UploadProposalVersionData {
  projectId: number;
  comment?: string | null;
  files: Array<{
    docType: string;
    buffer: Buffer;
    originalname: string;
    size: number;
  }>;
}

export interface ProposalVersionDocumentView {
  documentId: number;
  projectId: number;
  docType: string;
  visibility: string;
  fileName: string | null;
  fileSize: number | null;
  version: number;
  uploadedAt: Date;
  mandatoryReview: boolean;
  canChangeVisibility: boolean;
  reviewStatus: string;
  reviewedAt: Date | null;
  reviewerName: string | null;
  reviewNotes: string | null;
  canReview: boolean;
}

export interface ProposalVersionView {
  versionId: number;
  projectId: number;
  versionNumber: number;
  submittedBy: string;
  submitterName: string | null;
  submittedAt: Date;
  status: string;
  /** Dictamen del comite sobre esta version (null si sigue en revision). */
  decision: string | null;
  submitterComment: string | null;
  committeeComments: string | null;
  decidedAt: Date | null;
  reviewerName: string | null;
  createdAt: Date;
  documents: ProposalVersionDocumentView[];
}

export type ProposalVersionBlockedReason =
  | 'NOT_PRINCIPAL_INVESTIGATOR'
  | 'PROJECT_READ_ONLY'
  | 'REVISION_NOT_REQUIRED'
  | 'VERSION_LIMIT_REACHED';

export interface ProposalVersionStateView {
  projectId: number;
  maxVersions: number;
  versionsUsed: number;
  remainingVersions: number;
  nextVersionNumber: number;
  canUpload: boolean;
  blockedReason: ProposalVersionBlockedReason | null;
}

const documentSelect = {
  include: { reviewer: { select: { name: true } } },
  orderBy: { uploaded_at: 'desc' as const },
};

function toDocumentView(
  document: {
    document_id: number;
    project_id: number;
    doc_type: string;
    visibility: string;
    file_name: string | null;
    file_size: number | null;
    version: number;
    uploaded_at: Date;
    review_status: string;
    reviewed_at: Date | null;
    review_notes: string | null;
    reviewer?: { name: string } | null;
  },
): ProposalVersionDocumentView {
  return {
    documentId: document.document_id,
    projectId: document.project_id,
    docType: document.doc_type,
    visibility: document.visibility,
    fileName: document.file_name,
    fileSize: document.file_size,
    version: document.version,
    uploadedAt: document.uploaded_at,
    mandatoryReview: isMandatoryReviewDocument(document.doc_type),
    canChangeVisibility: false,
    reviewStatus: document.review_status,
    reviewedAt: document.reviewed_at,
    reviewerName: document.reviewer?.name ?? null,
    reviewNotes: document.review_notes,
    canReview: false,
  };
}

async function loadProjectForVersions(projectId: number, userId: string) {
  const project = await prisma.project.findUnique({
    where: { project_id: projectId },
    include: {
      projectUsers: {
        where: { user_id: userId },
        select: { project_role: true },
      },
      evaluations: {
        orderBy: { created_at: 'desc' },
        take: 1,
        select: {
          evaluation_id: true,
          decision: true,
          justification: true,
        },
      },
      proposalVersions: {
        orderBy: { version_number: 'desc' },
        take: 1,
        select: { version_number: true },
      },
    },
  });

  if (!project) {
    fail(PROPOSAL_VERSION_ERROR_CODES.NOT_FOUND, 'El proyecto no existe.', 404);
  }

  return project;
}

/**
 * Sube una version revisada de la propuesta. Solo procede cuando la ultima
 * decision del comite pidio correcciones y aun queda cupo en el historial.
 */
export async function uploadRevisedProposal(
  user: AuthenticatedUser,
  data: UploadProposalVersionData,
  ip: string = 'unknown',
): Promise<ProposalVersionView> {
  const issues = validateProposalVersionInput({
    projectId: data.projectId,
    comment: data.comment,
  });
  if (issues.length > 0) {
    const first = issues[0] as { field: string; message: string };
    fail(
      PROPOSAL_VERSION_ERROR_CODES.VALIDATION_ERROR,
      first.message,
      400,
      first.field,
    );
  }

  if (!data.files || data.files.length === 0) {
    fail(
      PROPOSAL_VERSION_ERROR_CODES.VALIDATION_ERROR,
      'Debes adjuntar al menos un documento para la version revisada.',
      400,
      'files',
    );
  }

  const docTypeIssue = validateProposalDocumentTypes(
    data.files.map((file) => file.docType),
  );
  if (docTypeIssue) {
    fail(
      PROPOSAL_VERSION_ERROR_CODES.VALIDATION_ERROR,
      docTypeIssue.message,
      400,
      docTypeIssue.field,
    );
  }

  const project = await loadProjectForVersions(data.projectId, user.id);

  assertProjectWritable(project as { is_read_only?: boolean | null });

  const isPrincipalInvestigator = project.projectUsers.some(
    (member) => member.project_role === 'Principal_Investigator',
  );
  if (!isPrincipalInvestigator) {
    fail(
      PROPOSAL_VERSION_ERROR_CODES.FORBIDDEN,
      'Solo el Investigador Principal puede subir una nueva version de la propuesta.',
      403,
    );
  }

  const latestEvaluation = project.evaluations[0];
  if (!latestEvaluation || latestEvaluation.decision !== 'Revision_Required') {
    fail(
      PROPOSAL_VERSION_ERROR_CODES.REVISION_NOT_REQUIRED,
      'Solo se pueden subir versiones revisadas cuando la ultima decision del comite solicita correcciones.',
      409,
    );
  }

  const latestVersionNumber =
    project.proposalVersions[0]?.version_number ?? null;
  const nextVersionNumber = nextProposalVersionNumber(latestVersionNumber);
  if (!canCreateProposalVersion(nextVersionNumber)) {
    fail(
      PROPOSAL_VERSION_ERROR_CODES.VERSION_LIMIT_REACHED,
      `El proyecto alcanzo el limite de ${MAX_PROPOSAL_VERSIONS} versiones de propuesta.`,
      409,
    );
  }

  // Validar formato y cuota antes de tocar el disco.
  let totalNewBytes = 0;
  for (const file of data.files) {
    const pdfIssue = validatePdfUpload(file.buffer, file.size);
    if (pdfIssue) {
      fail(
        file.size > MAX_FILE_BYTES
          ? PROPOSAL_VERSION_ERROR_CODES.PAYLOAD_TOO_LARGE
          : PROPOSAL_VERSION_ERROR_CODES.VALIDATION_ERROR,
        pdfIssue.message,
        file.size > MAX_FILE_BYTES ? 413 : 415,
        'files',
      );
    }
    totalNewBytes += file.size;
  }

  const aggregate = await prisma.projectDocument.aggregate({
    where: { project_id: data.projectId },
    _sum: { file_size: true },
  });
  if (exceedsProjectQuota(aggregate._sum.file_size ?? 0, totalNewBytes)) {
    fail(
      PROPOSAL_VERSION_ERROR_CODES.PAYLOAD_TOO_LARGE,
      'El proyecto excede la cuota de 500 MB al agregar estos documentos.',
      413,
      'files',
    );
  }

  // El escaneo ocurre antes de escribir: si falla, nada queda en disco.
  for (const file of data.files) {
    const scanResult = await antivirus.scan(file.buffer);
    if (scanResult === 'infected') {
      fail(
        PROPOSAL_VERSION_ERROR_CODES.MALWARE_DETECTED,
        'El archivo contiene malware y no puede guardarse.',
        422,
        'files',
      );
    }
    if (scanResult === 'unavailable') {
      fail(
        PROPOSAL_VERSION_ERROR_CODES.SCAN_UNAVAILABLE,
        'El servicio de analisis antivirus no esta disponible.',
        503,
        'files',
      );
    }
  }

  const dir = join(uploadBaseDir(), 'projects', String(data.projectId));
  await mkdir(dir, { recursive: true });

  const writtenFiles: Array<{
    docType: string;
    fileName: string;
    filePath: string;
    size: number;
    originalname: string;
  }> = [];
  const writtenPaths: string[] = [];

  try {
    for (const file of data.files) {
      const fileName = `${file.docType}_v${nextVersionNumber}_${Date.now()}_${writtenFiles.length}.pdf`;
      const absolutePath = join(dir, fileName);
      await writeFile(absolutePath, file.buffer);
      writtenPaths.push(absolutePath);
      writtenFiles.push({
        docType: file.docType,
        fileName,
        filePath: absolutePath.split(sep).join('/'),
        size: file.size,
        originalname: file.originalname,
      });
    }

    return await prisma.$transaction(async (tx) => {
      const newVersion = await tx.proposal_Version.create({
        data: {
          project_id: data.projectId,
          version_number: nextVersionNumber,
          submitted_by: user.id,
          status: 'Under_Review',
          submitter_comment: data.comment?.trim() || null,
          committee_comments: latestEvaluation.justification,
        },
      });

      const createdDocs = [];
      for (const file of writtenFiles) {
        const doc = await tx.projectDocument.create({
          data: {
            project_id: data.projectId,
            proposal_version_id: newVersion.version_id,
            doc_type: file.docType as DocType,
            visibility: 'Shared_with_administration',
            file_url: file.filePath,
            version: nextVersionNumber,
            file_name: file.originalname,
            file_size: file.size,
          },
        });
        createdDocs.push(doc);
      }

      const applied = await applyStatusTransition(tx, {
        projectId: data.projectId,
        actorId: user.id,
        from: project.status,
        to: 'Under_Review',
        justification:
          data.comment?.trim() || `Version revisada #${nextVersionNumber}`,
      });
      if (!applied.applied) {
        fail(
          PROPOSAL_VERSION_ERROR_CODES.VERSION_CONFLICT,
          'El proyecto cambio de estado durante la operacion. Recarga e intenta de nuevo.',
          409,
        );
      }

      await tx.audit_Log.create({
        data: {
          actor_id: user.id,
          action: proposalVersionUploadAuditAction(nextVersionNumber),
          target_id: String(data.projectId),
          source_ip: ip,
        },
      });

      await notifyRole(tx, ROLES.COMMITTEE, {
        type: 'Decision',
        title: 'Nueva version de propuesta sometida',
        message: `El proyecto "${project.title}" ha recibido una propuesta revisada (v${nextVersionNumber}) para evaluacion.`,
        link: `/proposal-evaluation/${data.projectId}`,
      });

      return {
        versionId: newVersion.version_id,
        projectId: newVersion.project_id,
        versionNumber: newVersion.version_number,
        submittedBy: newVersion.submitted_by,
        submitterName: user.name,
        submittedAt: newVersion.submitted_at,
        status: newVersion.status,
        decision: null,
        submitterComment: newVersion.submitter_comment,
        committeeComments: newVersion.committee_comments,
        decidedAt: newVersion.decided_at,
        reviewerName: null,
        createdAt: newVersion.created_at,
        documents: createdDocs.map(toDocumentView),
      } satisfies ProposalVersionView;
    });
  } catch (error) {
    await removeFiles(writtenPaths);
    if (isUniqueConstraintError(error)) {
      fail(
        PROPOSAL_VERSION_ERROR_CODES.VERSION_CONFLICT,
        'Otra version se registro al mismo tiempo. Recarga el expediente e intenta de nuevo.',
        409,
      );
    }
    throw error;
  }
}

/** Historial cronologico descendente (la version mas reciente primero). */
export async function listProposalVersions(
  viewer: AuthenticatedUser,
  projectId: number,
): Promise<ProposalVersionView[]> {
  const project = await prisma.project.findUnique({
    where: { project_id: projectId },
    select: {
      project_id: true,
      is_confidential: true,
      projectUsers: {
        where: { user_id: viewer.id },
        select: { project_role: true },
      },
    },
  });

  if (!project) {
    fail(PROPOSAL_VERSION_ERROR_CODES.NOT_FOUND, 'El proyecto no existe.', 404);
  }

  if (
    !canViewProposalVersions(viewer, {
      isTeamMember: project.projectUsers.length > 0,
      isConfidential: project.is_confidential,
    })
  ) {
    fail(
      PROPOSAL_VERSION_ERROR_CODES.FORBIDDEN,
      'No tienes acceso al historial de este proyecto.',
      403,
    );
  }

  const versions = await prisma.proposal_Version.findMany({
    where: { project_id: projectId },
    include: {
      submitter: { select: { name: true } },
      reviewer: { select: { name: true } },
      evaluation: { select: { decision: true } },
      documents: documentSelect,
    },
    orderBy: { version_number: 'desc' },
  });

  return versions.map((version) => ({
    versionId: version.version_id,
    projectId: version.project_id,
    versionNumber: version.version_number,
    submittedBy: version.submitted_by,
    submitterName: version.submitter?.name ?? null,
    submittedAt: version.submitted_at,
    status: version.status,
    decision: version.evaluation?.decision ?? null,
    submitterComment: version.submitter_comment,
    committeeComments: version.committee_comments,
    decidedAt: version.decided_at,
    reviewerName: version.reviewer?.name ?? null,
    createdAt: version.created_at,
    documents: version.documents.map(toDocumentView),
  }));
}

/**
 * Estado del historial para que la interfaz no replique reglas: dice si el
 * PI puede subir, cuantas versiones quedan y por que esta bloqueado.
 */
export async function proposalVersionState(
  viewer: AuthenticatedUser,
  projectId: number,
): Promise<ProposalVersionStateView> {
  const project = await loadProjectForVersions(projectId, viewer.id);

  if (
    !canViewProposalVersions(viewer, {
      isTeamMember: project.projectUsers.length > 0,
      isConfidential: project.is_confidential,
    })
  ) {
    fail(
      PROPOSAL_VERSION_ERROR_CODES.FORBIDDEN,
      'No tienes acceso al historial de este proyecto.',
      403,
    );
  }

  const latestVersionNumber =
    project.proposalVersions[0]?.version_number ?? null;
  const nextVersionNumber = nextProposalVersionNumber(latestVersionNumber);
  const isPrincipalInvestigator = project.projectUsers.some(
    (member) => member.project_role === 'Principal_Investigator',
  );
  const requiresRevision =
    project.evaluations[0]?.decision === 'Revision_Required';

  let blockedReason: ProposalVersionBlockedReason | null = null;
  if (!isPrincipalInvestigator) {
    blockedReason = 'NOT_PRINCIPAL_INVESTIGATOR';
  } else if (project.is_read_only) {
    blockedReason = 'PROJECT_READ_ONLY';
  } else if (!requiresRevision) {
    blockedReason = 'REVISION_NOT_REQUIRED';
  } else if (!canCreateProposalVersion(nextVersionNumber)) {
    blockedReason = 'VERSION_LIMIT_REACHED';
  }

  return {
    projectId,
    maxVersions: MAX_PROPOSAL_VERSIONS,
    versionsUsed: latestVersionNumber ?? 1,
    remainingVersions: remainingProposalVersions(latestVersionNumber),
    nextVersionNumber,
    canUpload: blockedReason === null,
    blockedReason,
  };
}
