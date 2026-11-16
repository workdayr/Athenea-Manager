import { UseGuards } from '@nestjs/common';
import { Args, Context, Int, Mutation, Resolver } from '@nestjs/graphql';
import { GraphQLError } from 'graphql';
import { ROLES } from '../auth/roles.constants.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { CurrentUser } from './current-user.decorator.js';
import {
  AnonymizationCertificationGql,
  RetentionBatchResultGql,
} from './project-ethics.model.js';
import {
  ProjectEthicsError,
  ProjectEthicsService,
} from './project-ethics.service.js';
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
  if (error instanceof ProjectEthicsError) {
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

/** F1-11: certificacion de anonimizacion y operacion manual de retencion. */
@Resolver()
@UseGuards(SessionGuard, RolesGuard)
export class ProjectEthicsResolver {
  constructor(private readonly ethics: ProjectEthicsService) {}

  @Mutation(() => AnonymizationCertificationGql)
  @Roles(ROLES.PRINCIPAL_INVESTIGATOR)
  async certifyProjectAnonymization(
    @Args('projectId', { type: () => Int }) projectId: number,
    @CurrentUser() user: AuthenticatedUser,
    @Context() ctx: GraphQLContext,
  ): Promise<AnonymizationCertificationGql> {
    try {
      const result = await this.ethics.certifyAnonymization(
        user,
        projectId,
        requestIp(ctx),
      );
      const gql = new AnonymizationCertificationGql();
      gql.projectId = result.projectId;
      gql.certified = result.certified;
      gql.certifiedAt = result.certifiedAt;
      return gql;
    } catch (error) {
      toGraphQLError(error);
    }
  }

  @Mutation(() => RetentionBatchResultGql)
  @Roles(ROLES.ADMINISTRATOR)
  async runRetentionScan(): Promise<RetentionBatchResultGql> {
    const result = await this.ethics.runRetentionScan();
    const gql = new RetentionBatchResultGql();
    gql.scanned = result.scanned;
    gql.noticesSent = result.noticesSent;
    gql.deleted = result.deleted;
    gql.failed = result.failed;
    return gql;
  }
}
