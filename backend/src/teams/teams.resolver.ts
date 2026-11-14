import { UseGuards } from '@nestjs/common';
import {
  Args,
  Context,
  ID,
  Int,
  Mutation,
  Query,
  Resolver,
} from '@nestjs/graphql';
import { ROLES } from '../auth/roles.constants.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { CurrentUser } from '../projects/current-user.decorator.js';
import {
  SessionGuard,
  type AuthenticatedUser,
} from '../projects/session.guard.js';
import {
  InvitationAcceptanceGql,
  InvitationStatusGql,
  InviteTeamMemberInput,
  ProjectRoleGql,
  TeamInvitationGql,
  TeamMemberGql,
} from './teams.model.js';
import {
  TeamsService,
  toTeamGraphQLError,
  type TeamInvitationView,
  type TeamMemberView,
} from './teams.service.js';

interface GraphQLContext {
  req?: {
    ip?: string;
    headers?: Record<string, string | string[] | undefined>;
  };
}

function requestIp(ctx: GraphQLContext): string {
  const forwarded = ctx.req?.headers?.['x-forwarded-for'];
  const first = Array.isArray(forwarded)
    ? forwarded[0]
    : forwarded?.split(',')[0]?.trim();
  return ctx.req?.ip ?? first ?? 'unknown';
}

function toMemberGql(view: TeamMemberView): TeamMemberGql {
  const gql = new TeamMemberGql();
  gql.userId = view.userId;
  gql.name = view.name;
  gql.email = view.email;
  gql.projectRole = view.projectRole as ProjectRoleGql;
  return gql;
}

function toInvitationGql(view: TeamInvitationView): TeamInvitationGql {
  const gql = new TeamInvitationGql();
  gql.invitationId = view.invitationId;
  gql.email = view.email;
  gql.projectRole = view.projectRole as ProjectRoleGql;
  gql.status = view.status as InvitationStatusGql;
  gql.expiresAt = view.expiresAt;
  gql.createdAt = view.createdAt;
  gql.acceptedAt = view.acceptedAt;
  return gql;
}

/**
 * F2-02 / RF-011: equipos e invitaciones.
 * Las mutaciones quedan restringidas a PI/Administrador; el servicio
 * comprueba ademas la pertenencia al proyecto (defensa en profundidad).
 */
@Resolver(() => TeamMemberGql)
@UseGuards(SessionGuard, RolesGuard)
export class TeamsResolver {
  constructor(private readonly teamsService: TeamsService) {}

  @Query(() => [TeamMemberGql])
  async teamMembers(
    @Args('projectId', { type: () => Int }) projectId: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TeamMemberGql[]> {
    try {
      const members = await this.teamsService.listMembers(user, projectId);
      return members.map(toMemberGql);
    } catch (error) {
      toTeamGraphQLError(error);
    }
  }

  @Query(() => [TeamInvitationGql])
  @Roles(ROLES.PRINCIPAL_INVESTIGATOR, ROLES.ADMINISTRATOR)
  async teamInvitations(
    @Args('projectId', { type: () => Int }) projectId: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TeamInvitationGql[]> {
    try {
      const rows = await this.teamsService.listInvitations(user, projectId);
      return rows.map(toInvitationGql);
    } catch (error) {
      toTeamGraphQLError(error);
    }
  }

  @Mutation(() => TeamInvitationGql)
  @Roles(ROLES.PRINCIPAL_INVESTIGATOR, ROLES.ADMINISTRATOR)
  async inviteTeamMember(
    @Args('projectId', { type: () => Int }) projectId: number,
    @Args('input') input: InviteTeamMemberInput,
    @CurrentUser() user: AuthenticatedUser,
    @Context() ctx: GraphQLContext,
  ): Promise<TeamInvitationGql> {
    try {
      const view = await this.teamsService.invite(
        user,
        projectId,
        {
          email: input.email,
          projectRole: input.projectRole,
          affidavitSigned: input.affidavitSigned,
        },
        requestIp(ctx),
      );
      return toInvitationGql(view);
    } catch (error) {
      toTeamGraphQLError(error);
    }
  }

  @Mutation(() => InvitationAcceptanceGql)
  async acceptInvitation(
    @Args('token', { type: () => String }) token: string,
    @CurrentUser() user: AuthenticatedUser,
    @Context() ctx: GraphQLContext,
  ): Promise<InvitationAcceptanceGql> {
    try {
      const result = await this.teamsService.accept(
        user,
        token,
        requestIp(ctx),
      );
      const gql = new InvitationAcceptanceGql();
      gql.projectId = result.projectId;
      gql.projectTitle = result.projectTitle;
      return gql;
    } catch (error) {
      toTeamGraphQLError(error);
    }
  }

  @Mutation(() => TeamInvitationGql)
  @Roles(ROLES.PRINCIPAL_INVESTIGATOR, ROLES.ADMINISTRATOR)
  async revokeInvitation(
    @Args('invitationId', { type: () => Int }) invitationId: number,
    @CurrentUser() user: AuthenticatedUser,
    @Context() ctx: GraphQLContext,
  ): Promise<TeamInvitationGql> {
    try {
      const view = await this.teamsService.revoke(
        user,
        invitationId,
        requestIp(ctx),
      );
      return toInvitationGql(view);
    } catch (error) {
      toTeamGraphQLError(error);
    }
  }

  @Mutation(() => TeamMemberGql)
  @Roles(ROLES.PRINCIPAL_INVESTIGATOR, ROLES.ADMINISTRATOR)
  async updateTeamMemberRole(
    @Args('projectId', { type: () => Int }) projectId: number,
    @Args('memberUserId', { type: () => ID }) memberUserId: string,
    @Args('projectRole', { type: () => ProjectRoleGql })
    projectRole: ProjectRoleGql,
    @CurrentUser() user: AuthenticatedUser,
    @Context() ctx: GraphQLContext,
  ): Promise<TeamMemberGql> {
    try {
      const view = await this.teamsService.updateRole(
        user,
        projectId,
        memberUserId,
        projectRole,
        requestIp(ctx),
      );
      return toMemberGql(view);
    } catch (error) {
      toTeamGraphQLError(error);
    }
  }
}
