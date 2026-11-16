import { UseGuards } from '@nestjs/common';
import {
  Args,
  Context,
  Int,
  Mutation,
  Query,
  Resolver,
} from '@nestjs/graphql';
import { GraphQLError } from 'graphql';
import { ROLES } from '../auth/roles.constants.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { CurrentUser } from './current-user.decorator.js';
import {
  ProjectSlaScanResultGql,
  ProjectStatusTransitionGql,
  ProjectTransitionResultGql,
} from './project-lifecycle.model.js';
import {
  ProjectLifecycleError,
  ProjectLifecycleService,
  type StatusHistoryRow,
} from './project-lifecycle.service.js';
import { ProjectStatusGql } from './projects.model.js';
import { SessionGuard, type AuthenticatedUser } from './session.guard.js';

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

function toGraphQLError(error: unknown): never {
  if (error instanceof ProjectLifecycleError) {
    throw new GraphQLError(error.message, {
      extensions: { code: error.code, field: error.field ?? null },
    });
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

function toHistoryGql(row: StatusHistoryRow): ProjectStatusTransitionGql {
  const item = new ProjectStatusTransitionGql();
  item.transitionId = row.transition_id;
  item.projectId = row.project_id;
  item.fromStatus = row.from_status as ProjectStatusGql;
  item.toStatus = row.to_status as ProjectStatusGql;
  item.justification = row.justification;
  item.actorName = row.actor.name;
  item.createdAt = row.created_at;
  return item;
}

/**
 * F1-02 / RF-003: transiciones manuales e historial del ciclo de vida.
 * La matriz de roles y las compuertas BR-003/BR-006 viven en el servicio.
 */
@Resolver()
@UseGuards(SessionGuard, RolesGuard)
export class ProjectLifecycleResolver {
  constructor(private readonly lifecycle: ProjectLifecycleService) {}

  @Mutation(() => ProjectTransitionResultGql)
  async transitionProjectStatus(
    @Args('projectId', { type: () => Int }) projectId: number,
    @Args('toStatus', { type: () => ProjectStatusGql })
    toStatus: ProjectStatusGql,
    @Args('justification', { type: () => String, nullable: true })
    justification: string | null,
    @CurrentUser() user: AuthenticatedUser,
    @Context() ctx: GraphQLContext,
  ): Promise<ProjectTransitionResultGql> {
    try {
      const result = await this.lifecycle.transition(
        user,
        projectId,
        toStatus,
        justification,
        requestIp(ctx),
      );
      const gql = new ProjectTransitionResultGql();
      gql.projectId = result.projectId;
      gql.previousStatus = result.previousStatus as ProjectStatusGql;
      gql.newStatus = result.newStatus as ProjectStatusGql;
      gql.transitionId = result.transitionId;
      gql.changedAt = result.changedAt;
      return gql;
    } catch (error) {
      toGraphQLError(error);
    }
  }

  @Query(() => [ProjectStatusTransitionGql])
  async projectStatusHistory(
    @Args('projectId', { type: () => Int }) projectId: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ProjectStatusTransitionGql[]> {
    try {
      const rows = await this.lifecycle.history(user, projectId);
      return rows.map(toHistoryGql);
    } catch (error) {
      toGraphQLError(error);
    }
  }

  @Mutation(() => ProjectSlaScanResultGql)
  @Roles(ROLES.ADMINISTRATOR)
  async runProjectSlaScan(): Promise<ProjectSlaScanResultGql> {
    const result = await this.lifecycle.runSlaScan();
    const gql = new ProjectSlaScanResultGql();
    gql.scanned = result.scanned;
    gql.notified = result.notified;
    return gql;
  }
}
