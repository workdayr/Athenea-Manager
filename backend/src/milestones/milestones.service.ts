import { prisma } from '../db/prisma.js';
import type { AuthenticatedUser } from '../projects/session.guard.js';
import {
  normalizeName,
  requireProjectMember,
  requireProjectPrincipalInvestigator,
  requireTeamAssignee,
} from './project-team.js';

export { PlanningError } from './planning.errors.js';

export interface CreateMilestoneData {
  projectId: number;
  name: string;
  assigneeId: string;
  dueDate: Date;
  status: 'Pending' | 'Completed' | 'Delayed';
}

export async function createMilestone(
  user: AuthenticatedUser,
  data: CreateMilestoneData,
) {
  await requireProjectPrincipalInvestigator(user, data.projectId);
  const name = normalizeName(data.name);
  await requireTeamAssignee(data.projectId, data.assigneeId);

  return prisma.milestone.create({
    data: {
      project_id: data.projectId,
      name,
      assignee_id: data.assigneeId,
      due_date: data.dueDate,
      status: data.status,
    },
    include: { assignee: { select: { name: true } } },
  });
}

export async function milestonesByProject(
  user: AuthenticatedUser,
  projectId: number,
) {
  await requireProjectMember(user, projectId);
  return prisma.milestone.findMany({
    where: { project_id: projectId },
    include: { assignee: { select: { name: true } } },
    orderBy: [{ due_date: 'asc' }, { milestone_id: 'asc' }],
  });
}

/** Equipo del proyecto: candidatos validos a responsable (Project_User). */
export async function projectTeam(user: AuthenticatedUser, projectId: number) {
  await requireProjectMember(user, projectId);
  return prisma.project_User.findMany({
    where: { project_id: projectId },
    include: { user: { select: { name: true, email: true } } },
    orderBy: { projectuser_id: 'asc' },
  });
}
