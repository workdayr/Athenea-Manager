import { UseGuards } from '@nestjs/common';
import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GraphQLError } from 'graphql';
import { MilestoneStatus } from '../generated/prisma/client.js';
import { Roles } from '../auth/roles.decorator.js';
import { ROLES } from '../auth/roles.constants.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { SortDirectionGql } from '../common/pagination/pagination.model.js';
import { CurrentUser } from '../projects/current-user.decorator.js';
import { SessionGuard, type AuthenticatedUser } from '../projects/session.guard.js';
import {
  CreateMilestoneInput,
  MilestoneGql,
  UpdateMilestoneInput,
} from './milestones.model.js';
import { MilestonesService } from './milestones.service.js';

@Resolver(() => MilestoneGql)
@UseGuards(SessionGuard, RolesGuard)
export class MilestonesResolver {
  constructor(private readonly milestonesService: MilestonesService) {}

  @Query(() => [MilestoneGql])
  async projectMilestones(
    @Args('projectId', { type: () => Int }) projectId: number,
    @CurrentUser() user: AuthenticatedUser,
    @Args('page', { type: () => Int, nullable: true }) page?: number,
    @Args('pageSize', { type: () => Int, nullable: true }) pageSize?: number,
    @Args('sortBy', { type: () => String, nullable: true }) sortBy?: string,
    @Args('sortDir', { type: () => SortDirectionGql, nullable: true })
    sortDir?: SortDirectionGql,
  ) {
    return this.milestonesService.getMilestones(user, projectId, {
      page,
      pageSize,
      sortBy,
      sortDir,
    });
  }

  /** F2-07 / RF-006: alta de hitos por el PI o administracion. */
  @Mutation(() => MilestoneGql)
  @Roles(ROLES.PRINCIPAL_INVESTIGATOR, ROLES.ADMINISTRATOR)
  async createMilestone(
    @Args('input', { type: () => CreateMilestoneInput })
    input: CreateMilestoneInput,
    @CurrentUser() user: AuthenticatedUser,
    @Args('sourceIp', { type: () => String, nullable: true }) sourceIp?: string,
  ) {
    return this.milestonesService.createMilestone(
      user,
      input,
      sourceIp ?? '0.0.0.0',
    );
  }

  @Mutation(() => MilestoneGql)
  @Roles(ROLES.PRINCIPAL_INVESTIGATOR, ROLES.ADMINISTRATOR)
  async updateMilestone(
    @Args('milestoneId', { type: () => Int }) milestoneId: number,
    @Args('input', { type: () => UpdateMilestoneInput })
    input: UpdateMilestoneInput,
    @CurrentUser() user: AuthenticatedUser,
    @Args('sourceIp', { type: () => String, nullable: true }) sourceIp?: string,
  ) {
    return this.milestonesService.updateMilestone(
      user,
      milestoneId,
      input,
      sourceIp ?? '0.0.0.0',
    );
  }

  /** Cualquier miembro asignado reporta avance; el servicio valida el rol. */
  @Mutation(() => MilestoneGql)
  async updateMilestoneProgress(
    @Args('milestoneId', { type: () => Int }) milestoneId: number,
    @Args('status', { type: () => MilestoneStatus })
    status: MilestoneStatus,
    @CurrentUser() user: AuthenticatedUser,
    @Args('sourceIp', { type: () => String, nullable: true }) sourceIp?: string,
  ) {
    if (
      status !== MilestoneStatus.Pending &&
      status !== MilestoneStatus.Completed
    ) {
      throw new GraphQLError('Solo se permite Pending o Completed.', {
        extensions: { code: 'VALIDATION_ERROR' },
      });
    }
    return this.milestonesService.updateMilestoneProgress(
      user,
      milestoneId,
      status,
      sourceIp ?? '0.0.0.0',
    );
  }

  @Mutation(() => MilestoneGql)
  @Roles(ROLES.PRINCIPAL_INVESTIGATOR, ROLES.ADMINISTRATOR)
  async assignMilestone(
    @Args('milestoneId', { type: () => Int }) milestoneId: number,
    @Args('assigneeId', { type: () => String }) assigneeId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Args('sourceIp', { type: () => String, nullable: true }) sourceIp?: string,
  ) {
    return this.milestonesService.assignMilestone(
      user,
      milestoneId,
      assigneeId,
      sourceIp ?? '0.0.0.0',
    );
  }

  @Mutation(() => Boolean)
  @Roles(ROLES.PRINCIPAL_INVESTIGATOR, ROLES.ADMINISTRATOR)
  async deleteMilestone(
    @Args('milestoneId', { type: () => Int }) milestoneId: number,
    @CurrentUser() user: AuthenticatedUser,
    @Args('sourceIp', { type: () => String, nullable: true }) sourceIp?: string,
  ) {
    return this.milestonesService.deleteMilestone(
      user,
      milestoneId,
      sourceIp ?? '0.0.0.0',
    );
  }

  /**
   * Permite al PRINCIPAL_INVESTIGATOR confirmar (marcar como Completed) una
   * tarea, independientemente de si el estudiante subio evidencia o no.
   */
  @Mutation(() => MilestoneGql)
  @Roles(ROLES.PRINCIPAL_INVESTIGATOR)
  async confirmMilestone(
    @Args('milestoneId', { type: () => Int }) milestoneId: number,
    @CurrentUser() pi: AuthenticatedUser,
  ) {
    return this.milestonesService.confirmMilestone(pi, milestoneId);
  }
}
