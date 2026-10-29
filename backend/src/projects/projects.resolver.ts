import { UseGuards } from '@nestjs/common';
import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GraphQLError } from 'graphql';
import { ROLES } from '../auth/roles.constants.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { CurrentUser } from './current-user.decorator.js';
import {
  ProjectGql,
  RegisterProjectInput,
} from './projects.model.js';
import { toProjectGql, type ProjectRow } from './projects.mapper.js';
import {
  activeProjectCount,
  myProjects,
  ProjectError,
  registerProject,
} from './projects.service.js';
import { SessionGuard, type AuthenticatedUser } from './session.guard.js';

function toGraphQLError(error: unknown): never {
  if (error instanceof ProjectError) {
    throw new GraphQLError(error.message, {
      extensions: { code: error.code, field: error.field ?? null },
    });
  }
  // US 2.2: registerProject delega a calls.service, que lanza CallError
  // (misma forma: code/message/httpStatus/field).
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

/**
 * Operaciones de dominio de proyectos (RF-002, BR-001, BR-002).
 * Los archivos viajan por REST (`POST /projects/:id/documents`).
 *
 * RF-001: `RolesGuard` aplica autorizacion por rol donde se declare
 * `@Roles()`. Las operaciones sin `@Roles()` requieren solo estar
 * autenticado (`SessionGuard`).
 */
@Resolver(() => ProjectGql)
@UseGuards(SessionGuard, RolesGuard)
export class ProjectsResolver {
  @Mutation(() => ProjectGql)
  @Roles(ROLES.PRINCIPAL_INVESTIGATOR)
  async registerProject(
    @Args('input') input: RegisterProjectInput,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ProjectGql> {
    try {
      const row = (await registerProject(user, {
        title: input.title,
        objectives: input.objectives,
        startDate: input.startDate,
        endDate: input.endDate,
        callId: input.callId,
      })) as unknown as ProjectRow;
      return toProjectGql(row, user);
    } catch (error) {
      toGraphQLError(error);
    }
  }

  @Query(() => [ProjectGql])
  async myProjects(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ProjectGql[]> {
    const rows = (await myProjects(user)) as unknown as ProjectRow[];
    return rows.map((row) => toProjectGql(row, user));
  }

  /** Cupo del PI para el banner "N de 3 activos" (BR-002). */
  @Query(() => Int)
  async activeProjectCount(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<number> {
    return activeProjectCount(user);
  }
}