import { createHash } from 'node:crypto';

/** Version del formato del snapshot (para futuras migraciones de archivo). */
export const ARCHIVE_SNAPSHOT_VERSION = 1;

export interface ArchiveProjectRow {
  project_id: number;
  title: string;
  objectives: string;
  start_date: Date | string;
  end_date: Date | string;
  status: string;
  budget_enabled: boolean;
  is_confidential: boolean;
  call_id: number | null;
  call?: { title: string } | null;
  projectUsers?: Array<{
    project_role: string;
    user: { id: string; name: string };
  }>;
  documents?: Array<{
    document_id: number;
    milestone_id: number | null;
    doc_type: string;
    visibility: string;
    file_url: string;
    version: number;
    file_name: string | null;
    file_size: number | null;
    uploaded_at: Date | string;
  }>;
  milestones?: Array<{
    milestone_id: number;
    name: string;
    assignee_id: string;
    due_date: Date | string;
    status: string;
    assignee?: { name: string } | null;
  }>;
  products?: Array<{
    product_id: number;
    product_type: string;
    url_doi: string;
  }>;
  expenses?: Array<{
    expense_id: number;
    amount: unknown;
    expense_description: string;
    expense_date: Date | string;
  }>;
  evaluations?: Array<{
    evaluation_id: number;
    reviewer_id: string;
    decision: string;
    justification: string;
    created_at: Date | string;
  }>;
  conflicts?: Array<{
    conflict_id: number;
    reviewer_id: string;
    status: string;
    detected_at: Date | string;
    resolved_at: Date | string | null;
    resolved_by: string | null;
    resolution_note: string | null;
  }>;
}

export interface ArchiveSnapshot {
  schemaVersion: number;
  archivedAt: string;
  project: {
    projectId: number;
    title: string;
    objectives: string;
    startDate: string;
    endDate: string;
    status: string;
    budgetEnabled: boolean;
    isConfidential: boolean;
    callId: number | null;
    callTitle: string | null;
  };
  team: Array<{ userId: string; name: string; role: string }>;
  documents: Array<{
    documentId: number;
    milestoneId: number | null;
    docType: string;
    visibility: string;
    fileUrl: string;
    version: number;
    fileName: string | null;
    fileSize: number | null;
    uploadedAt: string;
  }>;
  milestones: Array<{
    milestoneId: number;
    name: string;
    assigneeId: string;
    assigneeName: string | null;
    dueDate: string;
    status: string;
  }>;
  products: Array<{
    productId: number;
    productType: string;
    urlDoi: string;
  }>;
  expenses: Array<{
    expenseId: number;
    amount: string;
    description: string;
    expenseDate: string;
  }>;
  evaluations: Array<{
    evaluationId: number;
    reviewerId: string;
    decision: string;
    justification: string;
    createdAt: string;
  }>;
  conflicts: Array<{
    conflictId: number;
    reviewerId: string;
    status: string;
    detectedAt: string;
    resolvedAt: string | null;
    resolvedBy: string | null;
    resolutionNote: string | null;
  }>;
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

/**
 * Construye una copia congelada y determinista del expediente.
 * Las relaciones llegan ordenadas por su llave primaria desde la consulta,
 * de modo que el hash sea reproducible.
 */
export function buildArchiveSnapshot(
  row: ArchiveProjectRow,
  archivedAt: Date,
): ArchiveSnapshot {
  return {
    schemaVersion: ARCHIVE_SNAPSHOT_VERSION,
    archivedAt: archivedAt.toISOString(),
    project: {
      projectId: row.project_id,
      title: row.title,
      objectives: row.objectives,
      startDate: toIso(row.start_date),
      endDate: toIso(row.end_date),
      status: row.status,
      budgetEnabled: row.budget_enabled,
      isConfidential: row.is_confidential,
      callId: row.call_id,
      callTitle: row.call?.title ?? null,
    },
    team: (row.projectUsers ?? []).map((member) => ({
      userId: member.user.id,
      name: member.user.name,
      role: member.project_role,
    })),
    documents: (row.documents ?? []).map((document) => ({
      documentId: document.document_id,
      milestoneId: document.milestone_id,
      docType: document.doc_type,
      visibility: document.visibility,
      fileUrl: document.file_url,
      version: document.version,
      fileName: document.file_name,
      fileSize: document.file_size,
      uploadedAt: toIso(document.uploaded_at),
    })),
    milestones: (row.milestones ?? []).map((milestone) => ({
      milestoneId: milestone.milestone_id,
      name: milestone.name,
      assigneeId: milestone.assignee_id,
      assigneeName: milestone.assignee?.name ?? null,
      dueDate: toIso(milestone.due_date),
      status: milestone.status,
    })),
    products: (row.products ?? []).map((product) => ({
      productId: product.product_id,
      productType: product.product_type,
      urlDoi: product.url_doi,
    })),
    expenses: (row.expenses ?? []).map((expense) => ({
      expenseId: expense.expense_id,
      amount: String(expense.amount),
      description: expense.expense_description,
      expenseDate: toIso(expense.expense_date),
    })),
    evaluations: (row.evaluations ?? []).map((evaluation) => ({
      evaluationId: evaluation.evaluation_id,
      reviewerId: evaluation.reviewer_id,
      decision: evaluation.decision,
      justification: evaluation.justification,
      createdAt: toIso(evaluation.created_at),
    })),
    conflicts: (row.conflicts ?? []).map((conflict) => ({
      conflictId: conflict.conflict_id,
      reviewerId: conflict.reviewer_id,
      status: conflict.status,
      detectedAt: toIso(conflict.detected_at),
      resolvedAt: conflict.resolved_at ? toIso(conflict.resolved_at) : null,
      resolvedBy: conflict.resolved_by,
      resolutionNote: conflict.resolution_note,
    })),
  };
}

/**
 * Serializacion canonica: ordena las llaves de todos los objetos antes de
 * serializar. PostgreSQL (JSONB) no conserva el orden de insercion de las
 * llaves, por lo que `JSON.stringify` directo sobre el snapshot recuperado
 * produciria un hash distinto al original.
 */
export function canonicalizeArchiveValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalizeArchiveValue);
  }
  if (value !== null && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    return Object.keys(source)
      .sort()
      .reduce<Record<string, unknown>>((ordered, key) => {
        ordered[key] = canonicalizeArchiveValue(source[key]);
        return ordered;
      }, {});
  }
  return value;
}

/** Cadena estable del snapshot, independiente del orden de las llaves. */
export function serializeArchiveSnapshot(snapshot: ArchiveSnapshot): string {
  return JSON.stringify(canonicalizeArchiveValue(snapshot));
}

/** SHA-256 del snapshot serializado de forma canonica. */
export function hashArchiveSnapshot(snapshot: ArchiveSnapshot): string {
  return createHash('sha256')
    .update(serializeArchiveSnapshot(snapshot))
    .digest('hex');
}

/** Verifica que un snapshot recuperado coincida con el hash almacenado. */
export function verifyArchiveSnapshotHash(
  snapshot: ArchiveSnapshot,
  expectedHash: string,
): boolean {
  return hashArchiveSnapshot(snapshot) === expectedHash;
}
