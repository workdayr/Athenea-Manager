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
  ProjectGql,
  RegisterProjectInput,
  UpdateProjectSettingsInput,
} from './projects.model.js';
import { toProjectGql, type ProjectRow } from './projects.mapper.js';
import {
  activeProjectCount,
  getProjectForViewer,
  myProjects,
  ProjectError,
  registerProject,
  updateProjectSettings,
} from './projects.service.js';
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
        researchInvolvesHumans: input.researchInvolvesHumans,
        researchInvolvesAnimals: input.researchInvolvesAnimals,
        usesSensitiveData: input.usesSensitiveData,
        isConfidential: input.isConfidential,
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

  /** BR-007: detalle del proyecto con control de confidencialidad. */
  @Query(() => ProjectGql)
  async project(
    @Args('projectId', { type: () => Int }) projectId: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ProjectGql> {
    try {
      const row = (await getProjectForViewer(
        user,
        projectId,
      )) as unknown as ProjectRow;
      return toProjectGql(row, user);
    } catch (error) {
      toGraphQLError(error);
    }
  }

  /** F1-11: el PI ajusta confidencialidad y banderas de investigacion. */
  @Mutation(() => ProjectGql)
  @Roles(ROLES.PRINCIPAL_INVESTIGATOR)
  async updateProjectSettings(
    @Args('projectId', { type: () => Int }) projectId: number,
    @Args('input') input: UpdateProjectSettingsInput,
    @CurrentUser() user: AuthenticatedUser,
    @Context() ctx: GraphQLContext,
  ): Promise<ProjectGql> {
    try {
      const row = (await updateProjectSettings(
        user,
        projectId,
        {
          isConfidential: input.isConfidential,
          researchInvolvesHumans: input.researchInvolvesHumans,
          researchInvolvesAnimals: input.researchInvolvesAnimals,
          usesSensitiveData: input.usesSensitiveData,
        },
        requestIp(ctx),
      )) as unknown as ProjectRow;
      return toProjectGql(row, user);
    } catch (error) {
      toGraphQLError(error);
    }
  }

  /** Cupo del PI para el banner "N de 3 activos" (BR-002). */
  @Query(() => Int)
  async activeProjectCount(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<number> {
    return activeProjectCount(user);
  }
}