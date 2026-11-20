import { gql } from '@apollo/client';
import { getApolloClient } from './apollo-client';
import { getStoredToken } from './auth-client';

/**
 * Operaciones GraphQL del modulo proposal_evaluation.
 * Reutilizan `getApolloClient()` y `graphqlErrorCode()` de apollo-client
 * (mismo transporte `/api/graphql` + errorLink).
 */

export const PROPOSALS_PENDING_REVIEW_QUERY = gql`
  query ProposalsPendingReview {
    proposalsPendingReview {
      projectId
      title
      status
      hasConflict
      matchedSurnames
      conflictStatus
    }
  }
`;

export const PROPOSAL_EVALUATION_CONTEXT_QUERY = gql`
  query ProposalEvaluationContext($projectId: Int!) {
    proposalEvaluationContext(projectId: $projectId) {
      projectId
      title
      objectives
      status
      startDate
      endDate
      team {
        userId
        name
        email
        projectRole
      }
      evaluations {
        evaluationId
        reviewerId
        reviewerName
        decision
        justification
        createdAt
      }
      conflict {
        conflictId
        projectId
        projectTitle
        reviewerId
        reviewerName
        status
        detectedAt
        matchedSurnames
        resolvedAt
        resolutionNote
      }
      canEvaluate
      matchedSurnames
      blockReason
    }
  }
`;

export const SUBMIT_PROJECT_DECISION_MUTATION = gql`
  mutation SubmitProjectDecision($input: SubmitDecisionInput!) {
    submitProjectDecision(input: $input) {
      evaluationId
      projectId
      status
      decision
    }
  }
`;

/* -------------------------------------------------------------------------- */
/* dictamen PDF asincrono */
/* -------------------------------------------------------------------------- */

export type DecisionReportStatus = 'Pending' | 'Ready' | 'Failed';

export interface DecisionReport {
  reportId: number;
  evaluationId: number;
  status: DecisionReportStatus;
  readyAt: string | null;
  error: string | null;
  attempts: number;
}

export const DECISION_REPORT_STATUS_QUERY = gql`
  query DecisionReportStatus($evaluationId: Int!) {
    decisionReportStatus(evaluationId: $evaluationId) {
      reportId
      evaluationId
      status
      readyAt
      error
      attempts
    }
  }
`;

export async function fetchDecisionReportStatus(
  evaluationId: number,
): Promise<DecisionReport> {
  const result = await getApolloClient().query<{
    decisionReportStatus: DecisionReport;
  }>({
    query: DECISION_REPORT_STATUS_QUERY,
    variables: { evaluationId },
    fetchPolicy: 'network-only',
  });
  const report = result.data?.decisionReportStatus;
  if (!report) {
    throw new Error('El servidor no devolvió el estado del dictamen.');
  }
  return report;
}

/** Descarga el PDF con Bearer y dispara la descarga del navegador. */
export async function downloadDecisionReport(
  evaluationId: number,
): Promise<void> {
  const response = await fetch(`/api/decisions/${evaluationId}/report`, {
    headers: { Authorization: `Bearer ${getStoredToken()}` },
  });
  if (!response.ok) {
    let message = 'No fue posible descargar el dictamen.';
    try {
      const body = (await response.json()) as { message?: string };
      if (body.message) {
        message = body.message;
      }
    } catch {
      // Respuesta sin JSON: se conserva el mensaje generico.
    }
    throw new Error(message);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `dictamen-${evaluationId}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}

export const PENDING_CONFLICT_REVIEWS_QUERY = gql`
  query PendingConflictReviews {
    pendingConflictReviews {
      conflictId
      projectId
      projectTitle
      reviewerId
      reviewerName
      status
      detectedAt
      matchedSurnames
      resolvedAt
      resolutionNote
    }
  }
`;

export const RESOLVE_CONFLICT_REVIEW_MUTATION = gql`
  mutation ResolveConflictReview($input: ResolveConflictInput!) {
    resolveConflictReview(input: $input) {
      conflictId
      projectId
      projectTitle
      reviewerId
      reviewerName
      status
      detectedAt
      matchedSurnames
      resolvedAt
      resolutionNote
    }
  }
`;

export interface ProposalSummary {
  projectId: string;
  title: string;
  status: string;
  hasConflict: boolean;
  matchedSurnames: string[];
  conflictStatus: string | null;
}

export interface TeamMember {
  userId: string;
  name: string;
  email: string;
  projectRole: string;
}

export interface EvaluationRecord {
  evaluationId: string;
  reviewerId: string;
  reviewerName: string;
  decision: string;
  justification: string;
  createdAt: string;
}

export interface ConflictReview {
  conflictId: string;
  projectId: number;
  projectTitle: string;
  reviewerId: string;
  reviewerName: string;
  status: string;
  detectedAt: string;
  matchedSurnames: string[];
  resolvedAt: string | null;
  resolutionNote: string | null;
}

export interface ProposalContext {
  projectId: string;
  title: string;
  objectives: string;
  status: string;
  startDate: string;
  endDate: string;
  team: TeamMember[];
  evaluations: EvaluationRecord[];
  conflict: ConflictReview | null;
  canEvaluate: boolean;
  matchedSurnames: string[];
  blockReason: string | null;
}

export const DECISION_LABELS: Record<string, string> = {
  Approved: 'Aprobado',
  Rejected: 'Rechazado',
  Revision_Required: 'Requiere modificaciones',
};

/** Mensaje en español para cada motivo de bloqueo (blockReason). */
export function blockReasonMessage(
  blockReason: string | null,
  matchedSurnames: string[],
): string | null {
  if (blockReason === 'FAMILY_CONFLICT') {
    const surnames =
      matchedSurnames.length > 0 ? matchedSurnames.join(', ') : 'registrados';
    return (
      `Conflicto de interés familiar: apellidos coincidentes: ${surnames}. ` +
      'La evaluación está bloqueada hasta la revisión manual del Administrador.'
    );
  }
  if (blockReason === 'SELF_REVIEW') {
    return 'No puedes evaluar un proyecto de tu propio equipo.';
  }
  if (blockReason === 'DEPARTMENT_CONFLICT') {
    return 'No puedes evaluar un proyecto del mismo departamento que el Investigador Principal.';
  }
  if (blockReason === 'INVALID_STATE') {
    return 'El proyecto ya no admite decisión en su estado actual.';
  }
  return null;
}
