import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { ROLES } from '../auth/roles.constants.js';
import { prisma } from '../db/prisma.js';
import type { DocType, ProjectStatus } from '../generated/prisma/client.js';
import { notifyRole } from '../notifications/notifications.service.js';
import { applyStatusTransition } from '../projects/project-lifecycle.service.js';
import {
  MAX_FILE_BYTES,
  PROJECT_QUOTA_BYTES,
  REQUIRED_DOCUMENT_TYPES,
} from '../projects/projects.constants.js';
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

export interface ProposalVersionView {
  versionId: number;
  projectId: number;
  versionNumber: number;
  submittedBy: string;
  submitterName: string | null;
  submittedAt: Date;
  status: string;
  committeeComments: string | null;
  createdAt: Date;
  documents: Array<{
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
  }>;
}

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

  const project = await prisma.project.findUnique({
    where: { project_id: data.projectId },
    include: {
      projectUsers: {
        where: { user_id: user.id, project_role: 'Principal_Investigator' },
      },
      evaluations: {
        orderBy: { evaluation_id: 'desc' },
        take: 1,
      },
      proposalVersions: {
        orderBy: { version_number: 'desc' },
      },
    },
  });

  if (!project) {
    fail(PROPOSAL_VERSION_ERROR_CODES.NOT_FOUND, 'El proyecto no existe.', 404);
  }

  assertProjectWritable(project as { is_read_only?: boolean | null });

  if (project.projectUsers.length === 0) {
    fail(
      PROPOSAL_VERSION_ERROR_CODES.FORBIDDEN,
      'Solo el Investigador Principal puede subir una nueva version de la propuesta.',
      403,
    );
  }

  // RF-004: Solo si la ultima decision es Revision_Required
  const latestEvaluation = project.evaluations[0];
  if (!latestEvaluation || latestEvaluation.decision !== 'Revision_Required') {
    fail(
      PROPOSAL_VERSION_ERROR_CODES.REVISION_NOT_REQUIRED,
      'Solo se pueden subir versiones revisadas cuando la ultima decision del comite es Revision_Required.',
      409,
    );
  }

  const currentCount = project.proposalVersions.length;
  // Version inicial cuenta como 1 (cuando se creo el proyecto). Las revisiones van incrementando.
  if (!canCreateProposalVersion(currentCount)) {
    fail(
      PROPOSAL_VERSION_ERROR_CODES.VERSION_LIMIT_REACHED,
      `Se ha alcanzado el limite maximo de ${MAX_PROPOSAL_VERSIONS} versiones de propuesta.`,
      409,
    );
  }

  const nextVersionNumber =
    currentCount === 0 ? 2 : project.proposalVersions[0]!.version_number + 1;

  if (!data.files || data.files.length === 0) {
    fail(
      PROPOSAL_VERSION_ERROR_CODES.VALIDATION_ERROR,
      'Debes adjuntar al menos un documento para la version revisada.',
      400,
      'files',
    );
  }

  // Validar cuotas y formato de cada archivo
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

  const dir = join(uploadBaseDir(), 'projects', String(data.projectId));
  await mkdir(dir, { recursive: true });

  const writtenFiles: Array<{
    docType: string;
    fileName: string;
    filePath: string;
    size: number;
    originalname: string;
  }> = [];

  for (const file of data.files) {
    const fileName = `${file.docType}_v${nextVersionNumber}_${Date.now()}.pdf`;
    const absolutePath = join(dir, fileName);
    await writeFile(absolutePath, file.buffer);
    writtenFiles.push({
      docType: file.docType,
      fileName,
      filePath: absolutePath.split(sep).join('/'),
      size: file.size,
      originalname: file.originalname,
    });
  }

  return await prisma.$transaction(async (tx) => {
    // 1. Crear version inmutable
    const newVersion = await tx.proposal_Version.create({
      data: {
        project_id: data.projectId,
        version_number: nextVersionNumber,
        submitted_by: user.id,
        status: 'Under_Review',
        committee_comments: latestEvaluation.justification,
      },
    });

    // 2. Crear los ProjectDocument asociados
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

    // 3. Transicionar el proyecto a Under_Review si no lo estaba
    await applyStatusTransition(tx, {
      projectId: data.projectId,
      actorId: user.id,
      from: project.status,
      to: 'Under_Review',
      justification: data.comment ?? `Version revisada #${nextVersionNumber}`,
    });

    // 4. Auditar
    await tx.audit_Log.create({
      data: {
        actor_id: user.id,
        action: proposalVersionUploadAuditAction(nextVersionNumber),
        target_id: String(data.projectId),
        source_ip: ip,
      },
    });

    // 5. Notificar al comite
    await notifyRole(tx, ROLES.COMMITTEE, {
      type: 'Decision',
      title: 'Nueva versión de propuesta sometida',
      message: `El proyecto "${project.title}" ha recibido una propuesta revisada (v${nextVersionNumber}) para evaluación.`,
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
      committeeComments: newVersion.committee_comments,
      createdAt: newVersion.created_at,
      documents: createdDocs.map((d) => ({
        documentId: d.document_id,
        projectId: d.project_id,
        docType: d.doc_type,
        visibility: d.visibility,
        fileName: d.file_name,
        fileSize: d.file_size,
        version: d.version,
        uploadedAt: d.uploaded_at,
        mandatoryReview: true,
        canChangeVisibility: false,
        reviewStatus: d.review_status,
        reviewedAt: d.reviewed_at,
        reviewerName: null,
        reviewNotes: d.review_notes,
        canReview: false,
      })),
    };
  });
}

export async function listProposalVersions(
  projectId: number,
): Promise<ProposalVersionView[]> {
  const versions = await prisma.proposal_Version.findMany({
    where: { project_id: projectId },
    include: {
      submitter: { select: { name: true } },
      documents: {
        include: { reviewer: { select: { name: true } } },
        orderBy: { uploaded_at: 'desc' },
      },
    },
    orderBy: { version_number: 'desc' },
  });

  return versions.map((v) => ({
    versionId: v.version_id,
    projectId: v.project_id,
    versionNumber: v.version_number,
    submittedBy: v.submitted_by,
    submitterName: v.submitter?.name ?? null,
    submittedAt: v.submitted_at,
    status: v.status,
    committeeComments: v.committee_comments,
    createdAt: v.created_at,
    documents: v.documents.map((d) => ({
      documentId: d.document_id,
      projectId: d.project_id,
      docType: d.doc_type,
      visibility: d.visibility,
      fileName: d.file_name,
      fileSize: d.file_size,
      version: d.version,
      uploadedAt: d.uploaded_at,
      mandatoryReview: true,
      canChangeVisibility: false,
      reviewStatus: d.review_status,
      reviewedAt: d.reviewed_at,
      reviewerName: d.reviewer?.name ?? null,
      reviewNotes: d.review_notes,
      canReview: false,
    })),
  }));
}
