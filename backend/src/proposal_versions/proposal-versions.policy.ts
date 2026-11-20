import { ROLES } from '../auth/roles.constants.js';
import { INSTITUTIONAL_ROLES } from '../documents/documents.constants.js';
import {
  MAX_PROPOSAL_VERSIONS,
  PROPOSAL_COMMENT_MAX_LENGTH,
  PROPOSAL_DOCUMENT_TYPES,
} from './proposal-versions.constants.js';

export interface UploadProposalVersionInput {
  projectId: number;
  comment?: string | null;
}

export interface ProposalVersionValidationIssue {
  field: string;
  message: string;
}

/** Version que se asignara a la siguiente entrega (1 si aun no hay filas). */
export function nextProposalVersionNumber(latestVersionNumber: number | null): number {
  return latestVersionNumber && latestVersionNumber > 0
    ? latestVersionNumber + 1
    : 2;
}

/** El limite cuenta todas las versiones, incluida la propuesta inicial. */
export function canCreateProposalVersion(
  nextVersionNumber: number,
  maxVersions: number = MAX_PROPOSAL_VERSIONS,
): boolean {
  return nextVersionNumber <= maxVersions;
}

/** Versiones que aun puede subir el equipo. */
export function remainingProposalVersions(
  latestVersionNumber: number | null,
  maxVersions: number = MAX_PROPOSAL_VERSIONS,
): number {
  const used = latestVersionNumber ?? 1;
  return Math.max(0, maxVersions - used);
}

export function isProposalDocumentType(value: string): boolean {
  return (PROPOSAL_DOCUMENT_TYPES as readonly string[]).includes(value);
}

export function validateProposalVersionInput(
  input: UploadProposalVersionInput,
): ProposalVersionValidationIssue[] {
  const issues: ProposalVersionValidationIssue[] = [];

  if (input.comment && input.comment.trim().length > PROPOSAL_COMMENT_MAX_LENGTH) {
    issues.push({
      field: 'comment',
      message: `El comentario no puede exceder ${PROPOSAL_COMMENT_MAX_LENGTH} caracteres.`,
    });
  }

  return issues;
}

/** Cada archivo debe declarar un tipo documental soportado por la revision. */
export function validateProposalDocumentTypes(
  docTypes: readonly string[],
): ProposalVersionValidationIssue | null {
  if (docTypes.length === 0) {
    return {
      field: 'docTypes',
      message: 'Debes adjuntar al menos un documento para la version revisada.',
    };
  }
  const invalid = docTypes.find((docType) => !isProposalDocumentType(docType));
  if (invalid) {
    return {
      field: 'docTypes',
      message: `Tipo documental invalido: ${invalid}. Valores permitidos: ${PROPOSAL_DOCUMENT_TYPES.join(', ')}.`,
    };
  }
  return null;
}

export interface ProposalVersionViewer {
  id: string;
  role: string;
}

/** El equipo, la administracion y el comite pueden leer el historial. */
export function canViewProposalVersions(
  viewer: ProposalVersionViewer,
  context: { isTeamMember: boolean; isConfidential: boolean },
): boolean {
  const isInstitutional = (INSTITUTIONAL_ROLES as readonly string[]).includes(
    viewer.role,
  );
  if (!context.isTeamMember && !isInstitutional) {
    return false;
  }
  if (context.isConfidential) {
    return context.isTeamMember || viewer.role === ROLES.ADMINISTRATOR;
  }
  return true;
}
