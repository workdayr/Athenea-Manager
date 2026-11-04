import { gql } from '@apollo/client';
import { getStoredToken } from './auth-client';
import { getApolloClient } from './apollo-client';

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
