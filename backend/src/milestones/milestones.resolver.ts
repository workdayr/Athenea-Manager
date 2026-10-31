import { UseGuards } from '@nestjs/common';
import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GraphQLError } from 'graphql';
import { ROLES } from '../auth/roles.constants.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { CurrentUser } from '../projects/current-user.decorator.js';
import { SessionGuard, type AuthenticatedUser } from '../projects/session.guard.js';
import { CreateMilestoneInput } from './dto/create-milestone.input.js';
import { MilestoneGql, MilestoneTeamMemberGql } from './milestones.model.js';
import { MilestonesService } from './milestones.service.js';

// Errores de dominio (GraphQLError ya formado, o ProjectReadOnlyError con
// `code`/`field`) -> GraphQLError con code/field, como projects.resolver.
function toGraphQLError(error: unknown): never {
  if (error instanceof GraphQLError) {
    throw error;
  }
  if (
    typeof error === 'object' &&
    error !== null &&
    typeof (error as { code?: unknown }).code === 'string'
  ) {
    const domain = error as { code: string; message: string; field?: string };
    throw new GraphQLError(domain.message, {
      extensions: { code: domain.code, field: domain.field ?? null },
    });
  }
  throw error;
}

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

  /** US 5.1: equipo del proyecto (candidatos a responsable). */
  @Query(() => [MilestoneTeamMemberGql])
  async projectTeam(
    @Args('projectId', { type: () => Int }) projectId: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MilestoneTeamMemberGql[]> {
    return this.milestonesService.getProjectTeam(user, projectId);
  }

  /**
   * US 5.1: `@Roles(PRINCIPAL_INVESTIGATOR)` corta en `RolesGuard`; el
   * servicio ademas exige ser PI de ESE proyecto (defensa en profundidad).
   */
  @Mutation(() => MilestoneGql)
  @Roles(ROLES.PRINCIPAL_INVESTIGATOR)
  async createMilestone(
    @Args('input') input: CreateMilestoneInput,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MilestoneGql> {
    try {
      return (await this.milestonesService.createMilestone(
        user,
        input,
      )) as unknown as MilestoneGql;
    } catch (error) {
      toGraphQLError(error);
    }
  }
}
