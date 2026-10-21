import { UseGuards } from '@nestjs/common';
import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ROLES } from '../auth/roles.constants.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { CurrentUser } from '../projects/current-user.decorator.js';
import {
  SessionGuard,
  type AuthenticatedUser,
} from '../projects/session.guard.js';
import { CreateMilestoneInput } from './dto/create-milestone.input.js';
import {
  MilestoneGql,
  MilestoneStatusGql,
  ProjectTeamMemberGql,
} from './entities/milestone.entity.js';
import {
  createMilestone,
  milestonesByProject,
  projectTeam,
} from './milestones.service.js';
import { toGraphQLError } from './planning.errors.js';

interface MilestoneRow {
  milestone_id: number;
  project_id: number;
  name: string;
  assignee_id: string;
  assignee: { name: string };
  due_date: Date;
  status: string;
}

interface TeamRow {
  user_id: string;
  project_role: string;
  user: { name: string; email: string };
}

function toGql(row: MilestoneRow): MilestoneGql {
  const milestone = new MilestoneGql();
  milestone.milestoneId = row.milestone_id;
  milestone.projectId = row.project_id;
  milestone.name = row.name;
  milestone.assigneeId = row.assignee_id;
  milestone.assigneeName = row.assignee.name;
  milestone.dueDate = row.due_date;
  milestone.status = row.status as MilestoneStatusGql;
  return milestone;
}

/**
 * US 5.1: planificacion de hitos del proyecto.
 *
 * `@Roles(PRINCIPAL_INVESTIGATOR)` corta en `RolesGuard`; el servicio
 * valida ademas que el usuario sea el PI de ESE proyecto y que el
 * responsable pertenezca al equipo (defensa en profundidad).
 */
@Resolver(() => MilestoneGql)
@UseGuards(SessionGuard, RolesGuard)
export class MilestonesResolver {
  @Mutation(() => MilestoneGql)
  @Roles(ROLES.PRINCIPAL_INVESTIGATOR)
  async createMilestone(
    @Args('input') input: CreateMilestoneInput,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MilestoneGql> {
    try {
      const row = await createMilestone(user, {
        projectId: input.projectId,
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

  @Query(() => [MilestoneGql])
  async milestonesByProject(
    @Args('projectId', { type: () => Int }) projectId: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MilestoneGql[]> {
    try {
      const rows = await milestonesByProject(user, projectId);
      return rows.map(toGql);
    } catch (error) {
      toGraphQLError(error);
    }
  }

  @Query(() => [ProjectTeamMemberGql])
  async projectTeam(
    @Args('projectId', { type: () => Int }) projectId: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ProjectTeamMemberGql[]> {
    try {
      const rows = await projectTeam(user, projectId);
      return rows.map((row: TeamRow) => {
        const member = new ProjectTeamMemberGql();
        member.userId = row.user_id;
        member.name = row.user.name;
        member.email = row.user.email;
        member.projectRole = row.project_role;
        return member;
      });
    } catch (error) {
      toGraphQLError(error);
    }
  }
}
