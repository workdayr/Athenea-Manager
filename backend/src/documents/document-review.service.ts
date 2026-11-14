import { prisma } from '../db/prisma.js';
import type { DocumentReviewStatus } from '../generated/prisma/client.js';
import { assertProjectWritable } from '../projects/project-write-guard.js';
import type { AuthenticatedUser } from '../projects/session.guard.js';
import {
  DOCUMENT_REVIEW_ERROR_CODES,
  documentReviewAuditAction,
  type ReviewDecisionValue,
} from './document-review.constants.js';
import {
  isReviewDecision,
  isReviewableDocument,
  isReviewerRole,
  validateReviewNotes,
} from './document-review.policy.js';
import {
  toView,
  type DocumentRow,
  type ProjectDocumentView,
} from './documents.service.js';

/** Error de dominio: se mapea a GraphQL (extensions.code). */
export class DocumentReviewError extends Error {
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
  throw new DocumentReviewError(code, message, httpStatus, field);
}

/**
 * F1-11 / BR-003: aprueba o rechaza el informe final o la aprobacion de
 * etica. La aprobacion del informe final habilita `Active -> Completed`;
 * la de etica habilita la aprobacion del proyecto (BR-006).
 */
export async function reviewProjectDocument(
  user: AuthenticatedUser,
  projectId: number,
  documentId: number,
  decision: string,
  notes: string | null | undefined,
  ip: string,
): Promise<ProjectDocumentView> {
  if (!isReviewerRole(user.role)) {
    fail(
      DOCUMENT_REVIEW_ERROR_CODES.FORBIDDEN,
      'Solo la Administracion o la Coordinacion pueden revisar documentos (BR-003).',
      403,
    );
  }
  if (!isReviewDecision(decision)) {
    fail(
      DOCUMENT_REVIEW_ERROR_CODES.VALIDATION_ERROR,
      'Decision invalida. Valores permitidos: Approved, Rejected.',
      400,
      'decision',
    );
  }
  const notesIssue = validateReviewNotes(notes);
  if (notesIssue) {
    fail(
      DOCUMENT_REVIEW_ERROR_CODES.VALIDATION_ERROR,
      notesIssue,
      400,
      'notes',
    );
  }

  const project = await prisma.project.findUnique({
    where: { project_id: projectId },
    select: { project_id: true, is_read_only: true },
  });
  if (!project) {
    fail(
      DOCUMENT_REVIEW_ERROR_CODES.NOT_FOUND,
      'El proyecto no existe.',
      404,
    );
  }
  assertProjectWritable(project);

  const document = await prisma.projectDocument.findFirst({
    where: { document_id: documentId, project_id: projectId },
  });
  if (!document) {
    fail(
      DOCUMENT_REVIEW_ERROR_CODES.NOT_FOUND,
      'El documento no existe en este proyecto.',
      404,
    );
  }
  if (!isReviewableDocument(String(document.doc_type))) {
    fail(
      DOCUMENT_REVIEW_ERROR_CODES.NOT_REVIEWABLE,
      'Solo el informe final (results) y la aprobacion de etica requieren revision administrativa (BR-003).',
      409,
      'documentId',
    );
  }

  const updated = await prisma.projectDocument.update({
    where: { document_id: documentId },
    data: {
      review_status: decision as DocumentReviewStatus,
      reviewed_at: new Date(),
      reviewed_by: user.id,
      review_notes: notes?.trim() || null,
    },
    include: { reviewer: { select: { name: true } } },
  });

  await prisma.audit_Log.create({
    data: {
      actor_id: user.id,
      action: documentReviewAuditAction(
        String(updated.doc_type),
        decision as ReviewDecisionValue,
      ),
      target_id: String(documentId),
      source_ip: ip,
    },
  });

  return toView(updated as unknown as DocumentRow, false, true);
}
