import { UseGuards } from '@nestjs/common';
import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Roles } from '../auth/roles.decorator.js';
import { ROLES } from '../auth/roles.constants.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { CurrentUser } from '../projects/current-user.decorator.js';
import { SessionGuard, type AuthenticatedUser } from '../projects/session.guard.js';
import { MilestoneGql } from './milestones.model.js';
import { MilestonesService } from './milestones.service.js';

@Resolver(() => MilestoneGql)
@UseGuards(SessionGuard, RolesGuard)
export class MilestonesResolver {
  constructor(private readonly milestonesService: MilestonesService) {}

  @Query(() => [MilestoneGql])
  async projectMilestones(
    @Args('projectId', { type: () => Int }) projectId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.milestonesService.getMilestones(user, projectId);
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
