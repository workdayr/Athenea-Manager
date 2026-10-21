import { gql } from '@apollo/client';

/**
 * Operaciones GraphQL de US 5.1 (hitos y tareas).
 * Reutilizan `getApolloClient()` y `graphqlErrorCode()` de apollo-client
 * (mismo transporte `/api/graphql` + errorLink RF-001).
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

export const MILESTONES_BY_PROJECT_QUERY = gql`
  query MilestonesByProject($projectId: Int!) {
    milestonesByProject(projectId: $projectId) {
      milestoneId
      projectId
      name
      assigneeId
      assigneeName
      dueDate
      status
    }
  }
`;

export const TASKS_BY_MILESTONE_QUERY = gql`
  query TasksByMilestone($milestoneId: Int!) {
    tasksByMilestone(milestoneId: $milestoneId) {
      taskId
      milestoneId
      name
      assigneeId
      assigneeName
      dueDate
      status
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

export const CREATE_TASK_MUTATION = gql`
  mutation CreateTask($input: CreateTaskInput!) {
    createTask(input: $input) {
      taskId
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

export interface Milestone {
  milestoneId: number;
  projectId: number;
  name: string;
  assigneeId: string;
  assigneeName: string;
  dueDate: string;
  status: string;
}

export interface Task {
  taskId: number;
  milestoneId: number;
  name: string;
  assigneeId: string;
  assigneeName: string;
  dueDate: string;
  status: string;
}

export const STATUSES = ['Pending', 'Completed', 'Delayed'] as const;

export const STATUS_LABELS: Record<string, string> = {
  Pending: 'Pendiente',
  Completed: 'Completado',
  Delayed: 'Retrasado',
};

export const PROJECT_ROLE_LABELS: Record<string, string> = {
  Principal_Investigator: 'Investigador principal',
  Co_Investigator: 'Co-investigador',
  Assistant: 'Asistente',
};

/** `<input type="date">` (YYYY-MM-DD) -> ISO UTC que espera el scalar DateTime. */
export function dateInputToIso(value: string): string {
  return `${value}T00:00:00.000Z`;
}

/** Las fechas son de tipo DATE: se muestran en UTC para evitar desfases. */
export function formatDueDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-MX', { timeZone: 'UTC' });
}
