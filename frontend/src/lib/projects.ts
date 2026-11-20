import { gql } from '@apollo/client';
import { getApolloClient } from './apollo-client';

/** Detalle integral del proyecto. */

export interface ProjectTeamMember {
  name: string;
  role: string;
}

export interface ProjectDetail {
  projectId: string;
  title: string;
  objectives: string;
  startDate: string;
  endDate: string;
  status: string;
  callId: number | null;
  piName: string | null;
  callTitle: string | null;
  team: ProjectTeamMember[];
  milestonesTotal: number;
  milestonesCompleted: number;
  budgetEnabled: boolean;
  budgetSpent: number | null;
  isReadOnly: boolean;
  archivedAt: string | null;
  isConfidential: boolean;
  researchInvolvesHumans: boolean;
  researchInvolvesAnimals: boolean;
  usesSensitiveData: boolean;
  anonymizationCertified: boolean;
  anonymizationCertifiedAt: string | null;
  retentionDeleteAt: string | null;
  statusChangedAt: string;
}

export interface ProjectHistoryEntry {
  transitionId: number;
  projectId: number;
  fromStatus: string;
  toStatus: string;
  justification: string | null;
  actorName: string;
  createdAt: string;
}

export const PROJECT_DETAIL_QUERY = gql`
  query ProjectDetail($projectId: Int!) {
    project(projectId: $projectId) {
      projectId
      title
      objectives
      startDate
      endDate
      status
      callId
      piName
      callTitle
      team {
        name
        role
      }
      milestonesTotal
      milestonesCompleted
      budgetEnabled
      budgetSpent
      isReadOnly
      archivedAt
      isConfidential
      researchInvolvesHumans
      researchInvolvesAnimals
      usesSensitiveData
      anonymizationCertified
      anonymizationCertifiedAt
      retentionDeleteAt
      statusChangedAt
    }
  }
`;

export const PROJECT_HISTORY_QUERY = gql`
  query ProjectHistory($projectId: Int!) {
    projectStatusHistory(projectId: $projectId) {
      transitionId
      projectId
      fromStatus
      toStatus
      justification
      actorName
      createdAt
    }
  }
`;

export async function fetchProjectDetail(
  projectId: number,
): Promise<ProjectDetail> {
  const result = await getApolloClient().query<{ project: ProjectDetail }>({
    query: PROJECT_DETAIL_QUERY,
    variables: { projectId },
    fetchPolicy: 'network-only',
  });
  if (!result.data?.project) {
    throw new Error('El servidor no devolvio el proyecto.');
  }
  return result.data.project;
}

export async function fetchProjectHistory(
  projectId: number,
): Promise<ProjectHistoryEntry[]> {
  const result = await getApolloClient().query<{
    projectStatusHistory: ProjectHistoryEntry[];
  }>({
    query: PROJECT_HISTORY_QUERY,
    variables: { projectId },
    fetchPolicy: 'network-only',
  });
  return result.data?.projectStatusHistory ?? [];
}

export function projectErrorMessage(error: unknown): string {
  const message = (
    error as { graphQLErrors?: Array<{ message?: string }> }
  )?.graphQLErrors?.[0]?.message;
  if (message) {
    return message;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'No se pudo cargar el proyecto. Intenta de nuevo.';
}
