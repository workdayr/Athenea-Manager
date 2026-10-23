import { UseGuards } from '@nestjs/common';
import { Args, Int, Query, Resolver } from '@nestjs/graphql';
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
}