import { UseGuards } from '@nestjs/common';
import { Args, Context, Int, Mutation, Resolver } from '@nestjs/graphql';
import { GraphQLError } from 'graphql';
import { ROLES } from '../auth/roles.constants.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { CurrentUser } from '../projects/current-user.decorator.js';
import { ProjectReadOnlyError } from '../projects/project-write-guard.js';
import {
  SessionGuard,
  type AuthenticatedUser,
} from '../projects/session.guard.js';
import {
  DocumentReviewError,
  reviewProjectDocument,
} from './document-review.service.js';
import {
  DocumentReviewStatusGql,
  ProjectDocumentGql,
} from './documents.model.js';
import { toDocumentGql } from './documents.resolver.js';

function toGraphQLError(error: unknown): never {
  if (
    error instanceof DocumentReviewError ||
    error instanceof ProjectReadOnlyError
  ) {
    throw new GraphQLError(error.message, {
      extensions: { code: error.code, field: error.field ?? null },
    });
  }
  throw error;
}

/**
 * F1-11 / BR-003: revision administrativa del informe final y de la
 * aprobacion de etica. Aprueban Administracion y Coordinacion.
 */
@Resolver(() => ProjectDocumentGql)
@UseGuards(SessionGuard, RolesGuard)
export class DocumentReviewResolver {
  @Mutation(() => ProjectDocumentGql)
  @Roles(ROLES.ADMINISTRATOR, ROLES.COORDINATOR)
  async reviewProjectDocument(
    @Args('projectId', { type: () => Int }) projectId: number,
    @Args('documentId', { type: () => Int }) documentId: number,
    @Args('decision', { type: () => DocumentReviewStatusGql })
    decision: DocumentReviewStatusGql,
    @Args('notes', { type: () => String, nullable: true })
    notes: string | null,
    @CurrentUser() user: AuthenticatedUser,
    @Context() context: { req?: { ip?: string } },
  ): Promise<ProjectDocumentGql> {
    try {
      return toDocumentGql(
        await reviewProjectDocument(
          user,
          projectId,
          documentId,
          decision,
          notes,
          context.req?.ip ?? 'unknown',
        ),
      );
    } catch (error) {
      toGraphQLError(error);
    }
  }
}
