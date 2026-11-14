import {
  MAX_PROPOSAL_VERSIONS,
  PROPOSAL_COMMENT_MAX_LENGTH,
} from './proposal-versions.constants.js';

export interface UploadProposalVersionInput {
  projectId: number;
  comment?: string | null;
}

export interface ProposalVersionValidationIssue {
  field: string;
  message: string;
}

export function canCreateProposalVersion(
  currentVersionCount: number,
): boolean {
  return currentVersionCount < MAX_PROPOSAL_VERSIONS;
}

export function validateProposalVersionInput(
  input: UploadProposalVersionInput,
): ProposalVersionValidationIssue[] {
  const issues: ProposalVersionValidationIssue[] = [];

  if (
    input.comment &&
    input.comment.trim().length > PROPOSAL_COMMENT_MAX_LENGTH
  ) {
    issues.push({
      field: 'comment',
      message: `El comentario no puede exceder ${PROPOSAL_COMMENT_MAX_LENGTH} caracteres.`,
    });
  }

  return issues;
}
