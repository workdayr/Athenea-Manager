import { gql } from '@apollo/client';
import { getApolloClient } from './apollo-client';
import { getStoredToken } from './auth-client';

/** Panel del proyecto: consulta y confirmacion existentes (US 5.2). */
export const GET_MILESTONES_QUERY = gql`
  query ProjectMilestones($projectId: Int!) {
    projectMilestones(projectId: $projectId) {
      milestoneId
      name
      dueDate
      status
      assigneeId
      assigneeName
    }
  }
`;

export const CONFIRM_MILESTONE_MUTATION = gql`
  mutation ConfirmMilestone($milestoneId: Int!) {
    confirmMilestone(milestoneId: $milestoneId) {
      milestoneId
      status
    }
  }
`;

interface ConfirmMilestoneData {
  confirmMilestone: { milestoneId: number; status: string };
}

export async function uploadMilestoneEvidence(milestoneId: number, file: File) {
  const form = new FormData();
  form.append('file', file);

  const response = await fetch(`/api/milestones/${milestoneId}/evidence`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getStoredToken()}` },
    body: form,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message || 'Error al subir evidencia');
  }
  return response.json();
}

export async function confirmMilestoneEvidence(milestoneId: number) {
  const client = getApolloClient();
  const result = await client.mutate<ConfirmMilestoneData>({
    mutation: CONFIRM_MILESTONE_MUTATION,
    variables: { milestoneId },
  });
  return result.data?.confirmMilestone;
}

/** Hitos del proyecto y control de retrasos. */

export type MilestoneStatus = 'Pending' | 'Delayed' | 'Completed';

export interface Milestone {
  milestoneId: number;
  projectId: number;
  name: string;
  assigneeId: string;
  assigneeName: string;
  dueDate: string;
  status: MilestoneStatus;
  lastProgressAt: string;
}

export const MILESTONE_STATUS_LABELS: Record<MilestoneStatus, string> = {
  Pending: 'Pendiente',
  Delayed: 'Retrasado',
  Completed: 'Completado',
};

export const PROJECT_MILESTONES_QUERY = gql`
  query ProjectMilestones($projectId: Int!) {
    projectMilestones(projectId: $projectId) {
      milestoneId
      projectId
      name
      assigneeId
      assigneeName
      dueDate
      status
      lastProgressAt
    }
  }
`;

export const CREATE_MILESTONE_MUTATION = gql`
  mutation CreateMilestone($input: CreateMilestoneInput!) {
    createMilestone(input: $input) {
      milestoneId
      projectId
      name
      assigneeId
      assigneeName
      dueDate
      status
      lastProgressAt
    }
  }
`;

export const UPDATE_MILESTONE_MUTATION = gql`
  mutation UpdateMilestone(
    $milestoneId: Int!
    $input: UpdateMilestoneInput!
  ) {
    updateMilestone(milestoneId: $milestoneId, input: $input) {
      milestoneId
      projectId
      name
      assigneeId
      assigneeName
      dueDate
      status
      lastProgressAt
    }
  }
`;

export const UPDATE_MILESTONE_PROGRESS_MUTATION = gql`
  mutation UpdateMilestoneProgress(
    $milestoneId: Int!
    $status: MilestoneStatus!
  ) {
    updateMilestoneProgress(milestoneId: $milestoneId, status: $status) {
      milestoneId
      projectId
      name
      assigneeId
      assigneeName
      dueDate
      status
      lastProgressAt
    }
  }
`;

export const ASSIGN_MILESTONE_MUTATION = gql`
  mutation AssignMilestone($milestoneId: Int!, $assigneeId: ID!) {
    assignMilestone(milestoneId: $milestoneId, assigneeId: $assigneeId) {
      milestoneId
      projectId
      name
      assigneeId
      assigneeName
      dueDate
      status
      lastProgressAt
    }
  }
`;

export const DELETE_MILESTONE_MUTATION = gql`
  mutation DeleteMilestone($milestoneId: Int!) {
    deleteMilestone(milestoneId: $milestoneId)
  }
`;

export async function fetchProjectMilestones(
  projectId: number,
): Promise<Milestone[]> {
  const result = await getApolloClient().query<{
    projectMilestones: Milestone[];
  }>({
    query: PROJECT_MILESTONES_QUERY,
    variables: { projectId },
    fetchPolicy: 'network-only',
  });
  return result.data?.projectMilestones ?? [];
}

export async function createMilestone(input: {
  projectId: number;
  name: string;
  assigneeId: string;
  dueDate: string;
}): Promise<Milestone> {
  const result = await getApolloClient().mutate<{
    createMilestone: Milestone;
  }>({
    mutation: CREATE_MILESTONE_MUTATION,
    variables: { input },
  });
  const milestone = result.data?.createMilestone;
  if (!milestone) {
    throw new Error('El servidor no devolvio el hito creado.');
  }
  return milestone;
}

export async function updateMilestone(
  milestoneId: number,
  input: { name?: string; dueDate?: string },
): Promise<Milestone> {
  const result = await getApolloClient().mutate<{
    updateMilestone: Milestone;
  }>({
    mutation: UPDATE_MILESTONE_MUTATION,
    variables: { milestoneId, input },
  });
  const milestone = result.data?.updateMilestone;
  if (!milestone) {
    throw new Error('El servidor no devolvio el hito actualizado.');
  }
  return milestone;
}

export async function updateMilestoneProgress(
  milestoneId: number,
  status: 'Pending' | 'Completed',
): Promise<Milestone> {
  const result = await getApolloClient().mutate<{
    updateMilestoneProgress: Milestone;
  }>({
    mutation: UPDATE_MILESTONE_PROGRESS_MUTATION,
    variables: { milestoneId, status },
  });
  const milestone = result.data?.updateMilestoneProgress;
  if (!milestone) {
    throw new Error('El servidor no devolvio el hito actualizado.');
  }
  return milestone;
}

export async function assignMilestone(
  milestoneId: number,
  assigneeId: string,
): Promise<Milestone> {
  const result = await getApolloClient().mutate<{
    assignMilestone: Milestone;
  }>({
    mutation: ASSIGN_MILESTONE_MUTATION,
    variables: { milestoneId, assigneeId },
  });
  const milestone = result.data?.assignMilestone;
  if (!milestone) {
    throw new Error('El servidor no devolvio el hito reasignado.');
  }
  return milestone;
}

export async function deleteMilestone(milestoneId: number): Promise<boolean> {
  const result = await getApolloClient().mutate<{
    deleteMilestone: boolean;
  }>({
    mutation: DELETE_MILESTONE_MUTATION,
    variables: { milestoneId },
  });
  return result.data?.deleteMilestone ?? false;
}

export function milestoneErrorMessage(error: unknown): string {
  const message = (
    error as { graphQLErrors?: Array<{ message?: string }> }
  )?.graphQLErrors?.[0]?.message;
  if (message) {
    return message;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'No se pudo completar la operacion del hito. Intenta de nuevo.';
}
