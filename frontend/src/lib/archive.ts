import { gql } from '@apollo/client';
import { getApolloClient } from './apollo-client';

/** RF-020: consulta y reintento manual del archivado institucional. */

export interface ArchivedProject {
  projectId: number;
  title: string;
  status: string;
  archivedAt: string;
  snapshotHash: string;
}

export interface ArchivedProjectPage {
  items: ArchivedProject[];
  total: number;
  page: number;
  pageSize: number;
  pageInfo: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export interface ArchiveAlert {
  alertId: number;
  projectId: number | null;
  attemptedAt: string;
  errorMessage: string;
  resolvedAt: string | null;
}

export interface ArchiveOutcome {
  status: string;
  projectId: number;
  reason: string | null;
  error: string | null;
  snapshotHash: string | null;
  archiveId: number | null;
}

export interface ArchiveBatchResult {
  scanned: number;
  archived: number;
  skipped: number;
  failed: number;
}

export const ARCHIVED_PROJECTS_QUERY = gql`
  query ArchivedProjects($page: Int, $pageSize: Int) {
    archivedProjects(page: $page, pageSize: $pageSize) {
      items {
        projectId
        title
        status
        archivedAt
        snapshotHash
      }
      total
      page
      pageSize
      pageInfo {
        page
        pageSize
        total
        totalPages
        hasNextPage
        hasPreviousPage
      }
    }
  }
`;

export const ARCHIVE_ALERTS_QUERY = gql`
  query ArchiveAlerts($onlyUnresolved: Boolean) {
    archiveAlerts(onlyUnresolved: $onlyUnresolved) {
      alertId
      projectId
      attemptedAt
      errorMessage
      resolvedAt
    }
  }
`;

export const ARCHIVE_PROJECT_MUTATION = gql`
  mutation ArchiveProject($projectId: Int!) {
    archiveProject(projectId: $projectId) {
      status
      projectId
      reason
      error
      snapshotHash
      archiveId
    }
  }
`;

export const ARCHIVE_CLOSED_PROJECTS_MUTATION = gql`
  mutation ArchiveClosedProjects {
    archiveClosedProjects {
      scanned
      archived
      skipped
      failed
    }
  }
`;

export async function fetchArchivedProjects(
  page = 1,
  pageSize = 20,
): Promise<ArchivedProjectPage> {
  const result = await getApolloClient().query<{
    archivedProjects: ArchivedProjectPage;
  }>({
    query: ARCHIVED_PROJECTS_QUERY,
    variables: { page, pageSize },
    fetchPolicy: 'network-only',
  });
  if (!result.data?.archivedProjects) {
    throw new Error('El servidor no devolvio los expedientes archivados.');
  }
  return result.data.archivedProjects;
}

export async function fetchArchiveAlerts(
  onlyUnresolved = true,
): Promise<ArchiveAlert[]> {
  const result = await getApolloClient().query<{
    archiveAlerts: ArchiveAlert[];
  }>({
    query: ARCHIVE_ALERTS_QUERY,
    variables: { onlyUnresolved },
    fetchPolicy: 'network-only',
  });
  return result.data?.archiveAlerts ?? [];
}

export async function archiveProject(
  projectId: number,
): Promise<ArchiveOutcome> {
  const result = await getApolloClient().mutate<{
    archiveProject: ArchiveOutcome;
  }>({
    mutation: ARCHIVE_PROJECT_MUTATION,
    variables: { projectId },
  });
  if (!result.data?.archiveProject) {
    throw new Error('El servidor no devolvio el resultado del archivado.');
  }
  return result.data.archiveProject;
}

export async function archiveClosedProjects(): Promise<ArchiveBatchResult> {
  const result = await getApolloClient().mutate<{
    archiveClosedProjects: ArchiveBatchResult;
  }>({ mutation: ARCHIVE_CLOSED_PROJECTS_MUTATION });
  if (!result.data?.archiveClosedProjects) {
    throw new Error('El servidor no devolvio el resumen del archivado.');
  }
  return result.data.archiveClosedProjects;
}

export function archiveErrorMessage(error: unknown): string {
  const message = (
    error as { graphQLErrors?: Array<{ message?: string }> }
  )?.graphQLErrors?.[0]?.message;
  if (message) {
    return message;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'No se pudo completar la operacion de archivo. Intenta de nuevo.';
}
