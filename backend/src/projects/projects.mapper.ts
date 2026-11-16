import {
  ProjectGql,
  ProjectStatusGql,
  ProjectTeamMemberGql,
} from './projects.model.js';
import type { AuthenticatedUser } from './session.guard.js';

/**
 * Fila de `Project` con las relaciones que necesita el panel de proyecto.
 * Las relaciones son opcionales porque `registerProject` devuelve la fila
 * recien creada sin `include`.
 */
export interface ProjectRow {
  project_id: number;
  title: string;
  objectives: string;
  start_date: Date;
  end_date: Date;
  status: string;
  call_id: number | null;
  budget_enabled?: boolean;
  is_confidential?: boolean;
  research_involves_humans?: boolean;
  research_involves_animals?: boolean;
  uses_sensitive_data?: boolean;
  anonymization_certified?: boolean;
  anonymization_certified_at?: Date | null;
  retention_delete_at?: Date | null;
  retention_notified_at?: Date | null;
  retention_deleted_at?: Date | null;
  status_changed_at?: Date;
  is_read_only?: boolean | null;
  archived_at?: Date | null;
  call?: { title: string } | null;
  projectUsers?: Array<{
    project_role: string;
    user: { name: string };
  }>;
  milestones?: Array<{ status: string }>;
  expenses?: Array<{ amount: unknown }>;
}

function sumExpenses(row: ProjectRow): number {
  return (row.expenses ?? []).reduce(
    (total, expense) => total + Number(expense.amount ?? 0),
    0,
  );
}

/**
 * Traduce la fila de Prisma al contrato GraphQL.
 *
 * RF-001: el gasto solo se expone al Investigador Principal. El resto de
 * roles recibe `budgetSpent = null` y la UI oculta la tarjeta.
 */
export function toProjectGql(
  row: ProjectRow,
  user?: AuthenticatedUser,
): ProjectGql {
  const team = (row.projectUsers ?? []).map((member) => {
    const item = new ProjectTeamMemberGql();
    item.name = member.user.name;
    item.role = member.project_role;
    return item;
  });

  const principalInvestigator = team.find(
    (member) => member.role === 'Principal_Investigator',
  );

  const milestones = row.milestones ?? [];
  // Fail-closed: solo el PI recibe el gasto real.
  const budgetSpent =
    user?.role === 'PRINCIPAL_INVESTIGATOR' ? sumExpenses(row) : null;

  const project = new ProjectGql();
  project.projectId = row.project_id;
  project.title = row.title;
  project.objectives = row.objectives;
  project.startDate = row.start_date;
  project.endDate = row.end_date;
  project.status = row.status as ProjectStatusGql;
  project.callId = row.call_id;
  project.piName = principalInvestigator?.name ?? null;
  project.callTitle = row.call?.title ?? null;
  project.team = team;
  project.milestonesTotal = milestones.length;
  project.milestonesCompleted = milestones.filter(
    (milestone) => milestone.status === 'Completed',
  ).length;
  project.budgetEnabled = row.budget_enabled ?? false;
  project.budgetSpent = budgetSpent;
  project.isReadOnly = row.is_read_only === true;
  project.archivedAt = row.archived_at ?? null;
  project.isConfidential = row.is_confidential === true;
  project.researchInvolvesHumans = row.research_involves_humans === true;
  project.researchInvolvesAnimals = row.research_involves_animals === true;
  project.usesSensitiveData = row.uses_sensitive_data === true;
  project.anonymizationCertified = row.anonymization_certified === true;
  project.anonymizationCertifiedAt = row.anonymization_certified_at ?? null;
  project.retentionDeleteAt = row.retention_delete_at ?? null;
  project.retentionNotifiedAt = row.retention_notified_at ?? null;
  project.retentionDeletedAt = row.retention_deleted_at ?? null;
  project.statusChangedAt = row.status_changed_at ?? new Date(0);
  return project;
}
