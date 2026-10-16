import { UseGuards } from '@nestjs/common';
import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GraphQLError } from 'graphql';
import { CurrentUser } from './current-user.decorator.js';
import { ProjectGql, ProjectStatusGql, RegisterProjectInput } from './projects.model.js';
import {
  activeProjectCount,
  myProjects,
  ProjectError,
  registerProject,
} from './projects.service.js';
import { SessionGuard, type AuthenticatedUser } from './session.guard.js';

interface ProjectRow {
  project_id: number;
  title: string;
  objectives: string;
  start_date: Date;
  end_date: Date;
  status: string;
  call_id: number | null;
}

function toGql(row: ProjectRow): ProjectGql {
  const project = new ProjectGql();
  project.projectId = row.project_id;
  project.title = row.title;
  project.objectives = row.objectives;
  project.startDate = row.start_date;
  project.endDate = row.end_date;
  project.status = row.status as ProjectStatusGql;
  project.callId = row.call_id;
  return project;
}

function toGraphQLError(error: unknown): never {
  if (error instanceof ProjectError) {
    throw new GraphQLError(error.message, {
      extensions: { code: error.code, field: error.field ?? null },
    });
  }
  throw error;
}

/**
 * Operaciones de dominio de proyectos (RF-002, BR-001, BR-002).
 * Los archivos viajan por REST (`POST /projects/:id/documents`).
 */
@Resolver(() => ProjectGql)
@UseGuards(SessionGuard)
export class ProjectsResolver {
  @Mutation(() => ProjectGql)
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
      return toGql(row);
    } catch (error) {
      toGraphQLError(error);
    }
  }

  @Query(() => [ProjectGql])
  async myProjects(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ProjectGql[]> {
    const rows = (await myProjects(user)) as unknown as ProjectRow[];
    return rows.map(toGql);
  }

  /** Cupo del PI para el banner "N de 3 activos" (BR-002). */
  @Query(() => Int)
  async activeProjectCount(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<number> {
    return activeProjectCount(user);
  }
}
