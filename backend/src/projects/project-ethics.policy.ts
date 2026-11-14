import { DATASET_EXTENSIONS } from './project-ethics.constants.js';

/**
 * Reglas puras de F1-11 (BR-006, BR-012, BR-013). Sin E/S.
 */

export interface EthicsProjectFlags {
  research_involves_humans: boolean;
  research_involves_animals: boolean;
  uses_sensitive_data: boolean;
}

/** BR-006: la aprobacion de etica es obligatoria si hay humanos, animales o datos sensibles. */
export function requiresEthicsApproval(project: EthicsProjectFlags): boolean {
  return (
    project.research_involves_humans ||
    project.research_involves_animals ||
    project.uses_sensitive_data
  );
}

/** BR-006: un IRB es valido solo si fue aprobado por la administracion. */
export function isEthicsApprovalValid(document: {
  doc_type: string;
  review_status: string;
}): boolean {
  return (
    document.doc_type === 'ethics_approval' &&
    document.review_status === 'Approved'
  );
}

/** BR-012: solo los datasets de proyectos con humanos exigen certificacion. */
export function requiresAnonymizationCertification(
  project: EthicsProjectFlags & { anonymization_certified: boolean },
  extension: string,
): boolean {
  return (
    project.research_involves_humans &&
    !project.anonymization_certified &&
    (DATASET_EXTENSIONS as readonly string[]).includes(extension)
  );
}

/** BR-013: fecha de borrado seguro a N anos de la completion. */
export function computeRetentionDeleteAt(
  completedAt: Date,
  years: number,
): Date {
  const result = new Date(completedAt.getTime());
  result.setUTCFullYear(result.getUTCFullYear() + years);
  return result;
}

/** BR-013: el aviso se envia dentro de la ventana previa al borrado. */
export function isRetentionNoticeDue(
  deleteAt: Date | null,
  now: Date,
  noticeDays: number,
): boolean {
  if (!deleteAt) {
    return false;
  }
  const noticeWindow = now.getTime() + noticeDays * 24 * 60 * 60 * 1000;
  return deleteAt.getTime() > now.getTime() && deleteAt.getTime() <= noticeWindow;
}

/** BR-013: la fecha de borrado ya vencio. */
export function isRetentionDeletionDue(
  deleteAt: Date | null,
  now: Date,
): boolean {
  return deleteAt !== null && deleteAt.getTime() <= now.getTime();
}
