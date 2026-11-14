import { prisma } from '../db/prisma.js';
import type { Visibility } from '../generated/prisma/client.js';
import { PROJECT_ERROR_CODES } from '../projects/projects.constants.js';
import { assertProjectWritable } from '../projects/project-write-guard.js';
import type { AuthenticatedUser } from '../projects/session.guard.js';
import {
  normalizePageArgs,
  orderByFrom,
  PAGINATION_MAX_PAGE_SIZE,
  type PageArgs,
} from '../common/pagination/pagination.policy.js';
import { visibilityChangeAuditAction } from './documents.constants.js';
import {
  isReviewableDocument,
  isReviewerRole,
} from './document-review.policy.js';
import {
  canManageVisibility,
  isInstitutionalRole,
  isMandatoryReviewDocument,
  isSupportedVisibility,
  isVisibilityLocked,
  validateVisibilityChange,
} from './documents.policy.js';

/** Error de dominio: se mapea a GraphQL (extensions.code). */
export class DocumentVisibilityError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly httpStatus: number,
    readonly field?: string,
  ) {
    super(message);
  }
}

/** Vista segura del documento: nunca expone `file_url` (RF-005). */
export interface ProjectDocumentView {
  document_id: number;
  project_id: number;
  doc_type: string;
  visibility: string;
  file_name: string | null;
  file_size: number | null;
  version: number;
  uploaded_at: Date;
  mandatory_review: boolean;
  can_change_visibility: boolean;
  /** F1-11 / BR-003: estado de revision administrativa. */
  review_status: string;
  reviewed_at: Date | null;
  reviewer_name: string | null;
  review_notes: string | null;
  can_review: boolean;
}

export interface DocumentRow {
  document_id: number;
  project_id: number;
  doc_type: string;
  visibility: string;
  file_name: string | null;
  file_size: number | null;
  version: number;
  uploaded_at: Date;
  review_status?: string;
  reviewed_at?: Date | null;
  review_notes?: string | null;
  reviewer?: { name: string } | null;
}

function fail(
  code: string,
  message: string,
  httpStatus: number,
  field?: string,
): never {
  throw new DocumentVisibilityError(code, message, httpStatus, field);
}

export function toView(
  row: DocumentRow,
  canChangeVisibility: boolean,
  canReview = false,
): ProjectDocumentView {
  return {
    document_id: row.document_id,
    project_id: row.project_id,
    doc_type: row.doc_type,
    visibility: row.visibility,
    file_name: row.file_name,
    file_size: row.file_size,
    version: row.version,
    uploaded_at: row.uploaded_at,
    mandatory_review: isMandatoryReviewDocument(row.doc_type),
    can_change_visibility: canChangeVisibility,
    review_status: row.review_status ?? 'Pending',
    reviewed_at: row.reviewed_at ?? null,
    reviewer_name: row.reviewer?.name ?? null,
    review_notes: row.review_notes ?? null,
    can_review: canReview && isReviewableDocument(row.doc_type),
  };
}

function canReviewFor(user: AuthenticatedUser, docType: string): boolean {
  return isReviewerRole(user.role) && isReviewableDocument(docType);
}

function canChangeFor(
  projectRole: string | null,
  projectStatus: string,
  docType: string,
): boolean {
  return (
    canManageVisibility(projectRole) &&
    !isVisibilityLocked(projectStatus) &&
    !isMandatoryReviewDocument(docType)
  );
}

/**
 * US 4.1 / RF-005: cambia la visibilidad de un documento del proyecto.
 *
 * Solo el PI del proyecto puede hacerlo. Se rechaza:
 * - marcar como `Team_only` un documento de revision obligatoria
 *   (protocolo / aprobacion de etica): MANDATORY_DOCUMENT_VISIBILITY;
 * - cualquier cambio en proyectos Closed / Completed / Rejected:
 *   PROJECT_STATE_IMMUTABLE.
 *
 * Los `doc_type` obligatorios se leen de la BD, nunca del cliente.
 */
export async function setDocumentVisibility(
  user: AuthenticatedUser,
  projectId: number,
  documentId: number,
  visibility: string,
  ip: string,
): Promise<ProjectDocumentView> {
  if (!isSupportedVisibility(visibility)) {
    fail(
      PROJECT_ERROR_CODES.VALIDATION_ERROR,
      'Visibilidad invalida. Valores permitidos: Team_only, Shared_with_administration.',
      400,
      'visibility',
    );
  }

  const project = await prisma.project.findUnique({
    where: { project_id: projectId },
  });
  if (!project) {
    fail(PROJECT_ERROR_CODES.NOT_FOUND, 'El proyecto no existe.', 404);
  }

  const membership = await prisma.project_User.findFirst({
    where: {
      project_id: projectId,
      user_id: user.id,
      project_role: 'Principal_Investigator',
    },
  });
  if (!membership) {
    fail(
      PROJECT_ERROR_CODES.FORBIDDEN,
      'Solo el Investigador Principal del proyecto puede configurar la visibilidad de sus documentos.',
      403,
    );
  }

  // RF-020: el archivo institucional es inmutable.
  assertProjectWritable(project as { is_read_only?: boolean | null });

  const document = await prisma.projectDocument.findFirst({
    where: { document_id: documentId, project_id: projectId },
    include: { reviewer: { select: { name: true } } },
  });
  if (!document) {
    fail(
      PROJECT_ERROR_CODES.NOT_FOUND,
      'El documento no existe en este proyecto.',
      404,
    );
  }

  const issue = validateVisibilityChange({
    docType: String(document.doc_type),
    visibility,
    projectStatus: String(project.status),
  });
  if (issue) {
    fail(issue.code, issue.message, issue.httpStatus, issue.field);
  }

  // Cambio idempotente: no reescribe ni audita si la visibilidad ya es la misma.
  if (document.visibility === visibility) {
    return toView(
      document as unknown as DocumentRow,
      canChangeFor(membership.project_role, String(project.status), String(document.doc_type)),
      canReviewFor(user, String(document.doc_type)),
    );
  }

  const updated = await prisma.projectDocument.update({
    where: { document_id: documentId },
    data: { visibility: visibility as Visibility },
    include: { reviewer: { select: { name: true } } },
  });

  // RF-017: toda configuracion de visibilidad queda auditada.
  await prisma.audit_Log.create({
    data: {
      actor_id: user.id,
      action: visibilityChangeAuditAction(String(updated.doc_type), visibility),
      target_id: String(documentId),
      source_ip: ip,
    },
  });

  return toView(
    updated as unknown as DocumentRow,
    canChangeFor(membership.project_role, String(project.status), String(updated.doc_type)),
    canReviewFor(user, String(updated.doc_type)),
  );
}

/**
 * US 4.1 / RF-005: lista los documentos del proyecto segun el rol.
 *
 * - Miembros del equipo: todos los documentos del proyecto.
 * - Roles institucionales (administracion, coordinacion, comite): solo los
 *   marcados como `Shared_with_administration`; los privados del equipo no
 *   se exponen.
 * - Cualquier otro usuario: FORBIDDEN.
 */
export async function listProjectDocuments(
  user: AuthenticatedUser,
  projectId: number,
  paging: PageArgs = {},
): Promise<ProjectDocumentView[]> {
  const project = await prisma.project.findUnique({
    where: { project_id: projectId },
  });
  if (!project) {
    fail(PROJECT_ERROR_CODES.NOT_FOUND, 'El proyecto no existe.', 404);
  }

  const membership = await prisma.project_User.findFirst({
    where: { project_id: projectId, user_id: user.id },
  });
  const isMember = Boolean(membership);

  if (!isMember && !isInstitutionalRole(user.role)) {
    fail(
      PROJECT_ERROR_CODES.FORBIDDEN,
      'No tienes acceso a los documentos de este proyecto.',
      403,
    );
  }

  // F2-03 / RF-013: paginacion y orden del lado del servidor.
  const ordering = normalizePageArgs(
    { ...paging, pageSize: paging.pageSize ?? PAGINATION_MAX_PAGE_SIZE },
    ['uploadedAt', 'docType', 'version'],
    { sortBy: 'uploadedAt', sortDir: 'desc' },
  );
  const documents = await prisma.projectDocument.findMany({
    where: {
      project_id: projectId,
      ...(isMember
        ? {}
        : { visibility: 'Shared_with_administration' as Visibility }),
    },
    orderBy:
      orderByFrom(ordering, {
        uploadedAt: 'uploaded_at',
        docType: 'doc_type',
        version: 'version',
      }) ?? { uploaded_at: 'desc' },
    skip: ordering.skip,
    take: ordering.take,
    include: { reviewer: { select: { name: true } } },
  });

  return (documents as unknown as DocumentRow[]).map((row) =>
    toView(
      row,
      isMember
        ? canChangeFor(
            membership?.project_role ?? null,
            String(project.status),
            row.doc_type,
          )
        : false,
      canReviewFor(user, row.doc_type),
    ),
  );
}
