import { prisma } from '../db/prisma.js';
import { PlanningError } from '../milestones/planning.errors.js';
import {
  normalizeName,
  requireProjectMember,
  requireProjectPrincipalInvestigator,
  requireTeamAssignee,
} from '../milestones/project-team.js';
import type { AuthenticatedUser } from '../projects/session.guard.js';

export interface CreateTaskData {
  milestoneId: number;
  name: string;
  assigneeId: string;
  dueDate: Date;
  status: 'Pending' | 'Completed' | 'Delayed';
}

async function getMilestone(milestoneId: number) {
  const milestone = await prisma.milestone.findUnique({
    where: { milestone_id: milestoneId },
    select: { milestone_id: true, project_id: true },
  });
  if (!milestone) {
    throw new PlanningError('NOT_FOUND', 'El hito no existe.', 'milestoneId');
  }
  return milestone;
}

export async function createTask(user: AuthenticatedUser, data: CreateTaskData) {
  const milestone = await getMilestone(data.milestoneId);
  await requireProjectPrincipalInvestigator(user, milestone.project_id);
  const name = normalizeName(data.name);
  await requireTeamAssignee(milestone.project_id, data.assigneeId);

  return prisma.task.create({
    data: {
      milestone_id: milestone.milestone_id,
      name,
      assignee_id: data.assigneeId,
      due_date: data.dueDate,
      status: data.status,
    },
    include: { assignee: { select: { name: true } } },
  });
}

export async function tasksByMilestone(
  user: AuthenticatedUser,
  milestoneId: number,
) {
  const milestone = await getMilestone(milestoneId);
  await requireProjectMember(user, milestone.project_id);
  return prisma.task.findMany({
    where: { milestone_id: milestoneId },
    include: { assignee: { select: { name: true } } },
    orderBy: [{ due_date: 'asc' }, { task_id: 'asc' }],
  });
}
