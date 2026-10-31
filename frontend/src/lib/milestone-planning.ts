import { gql } from '@apollo/client';

/**
 * US 5.1: planificacion de hitos (crear + equipo del proyecto).
 * La consulta de hitos (`projectMilestones`) y la subida de evidencia
 * (US 5.2) viven en `@/lib/milestones`.
 */

export const PROJECT_TEAM_QUERY = gql`
  query ProjectTeam($projectId: Int!) {
    projectTeam(projectId: $projectId) {
      userId
      name
      email
      projectRole
    }
  }
`;

export const CREATE_MILESTONE_MUTATION = gql`
  mutation CreateMilestone($input: CreateMilestoneInput!) {
    createMilestone(input: $input) {
      milestoneId
      name
      status
    }
  }
`;

export interface TeamMember {
  userId: string;
  name: string;
  email: string;
  projectRole: string;
}

export const PROJECT_ROLE_LABELS: Record<string, string> = {
  Principal_Investigator: 'Investigador Principal',
  Co_Investigator: 'Co-Investigador',
  Assistant: 'Asistente de investigación',
};

/** `<input type="date">` (YYYY-MM-DD) -> ISO UTC que espera el scalar DateTime. */
export function dateInputToIso(value: string): string {
  return `${value}T00:00:00.000Z`;
}

/** Hoy en la zona local, en formato YYYY-MM-DD (atributo `min` del input). */
export function todayInputValue(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}
