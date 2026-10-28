import { gql } from '@apollo/client';
import { getStoredToken } from './auth-client';

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