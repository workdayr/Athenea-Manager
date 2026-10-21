import { UseGuards } from '@nestjs/common';
import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ROLES } from '../auth/roles.constants.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { MilestoneStatusGql } from '../milestones/entities/milestone.entity.js';
import { toGraphQLError } from '../milestones/planning.errors.js';
import { CurrentUser } from '../projects/current-user.decorator.js';
import {
  SessionGuard,
  type AuthenticatedUser,
} from '../projects/session.guard.js';
import { CreateTaskInput } from './dto/create-task.input.js';
import { TaskGql } from './entities/task.entity.js';
import { createTask, tasksByMilestone } from './tasks.service.js';

interface TaskRow {
  task_id: number;
  milestone_id: number;
  name: string;
  assignee_id: string;
  assignee: { name: string };
  due_date: Date;
  status: string;
}

function toGql(row: TaskRow): TaskGql {
  const task = new TaskGql();
  task.taskId = row.task_id;
  task.milestoneId = row.milestone_id;
  task.name = row.name;
  task.assigneeId = row.assignee_id;
  task.assigneeName = row.assignee.name;
  task.dueDate = row.due_date;
  task.status = row.status as MilestoneStatusGql;
  return task;
}

/**
 * US 5.1: asignacion de tareas a un hito.
 *
 * Misma politica que MilestonesResolver: `@Roles(PRINCIPAL_INVESTIGATOR)`
 * en la mutacion, y el servicio verifica PI del proyecto + responsable
 * perteneciente al equipo.
 */
@Resolver(() => TaskGql)
@UseGuards(SessionGuard, RolesGuard)
export class TasksResolver {
  @Mutation(() => TaskGql)
  @Roles(ROLES.PRINCIPAL_INVESTIGATOR)
  async createTask(
    @Args('input') input: CreateTaskInput,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TaskGql> {
    try {
      const row = await createTask(user, {
        milestoneId: input.milestoneId,
        name: input.name,
        assigneeId: input.assigneeId,
        dueDate: input.dueDate,
        status: input.status,
      });
      return toGql(row);
    } catch (error) {
      toGraphQLError(error);
    }
  }

  @Query(() => [TaskGql])
  async tasksByMilestone(
    @Args('milestoneId', { type: () => Int }) milestoneId: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TaskGql[]> {
    try {
      const rows = await tasksByMilestone(user, milestoneId);
      return rows.map(toGql);
    } catch (error) {
      toGraphQLError(error);
    }
  }
}
