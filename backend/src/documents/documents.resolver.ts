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
import { CurrentUser } from '../projects/current-user.decorator.js';
import { ProjectReadOnlyError } from '../projects/project-write-guard.js';
import {
  SessionGuard,
  type AuthenticatedUser,
} from '../projects/session.guard.js';
import {
  DocumentVisibilityGql,
  ProjectDocumentGql,
} from './documents.model.js';
import {
  DocumentVisibilityError,
  listProjectDocuments,
  setDocumentVisibility,
  type ProjectDocumentView,
} from './documents.service.js';

function toGql(row: ProjectDocumentView): ProjectDocumentGql {
  const document = new ProjectDocumentGql();
  document.documentId = row.document_id;
  document.projectId = row.project_id;
  document.docType = row.doc_type as ProjectDocumentGql['docType'];
  document.visibility = row.visibility as DocumentVisibilityGql;
  document.fileName = row.file_name;
  document.fileSize = row.file_size;
  document.version = row.version;
  document.uploadedAt = row.uploaded_at;
  document.mandatoryReview = row.mandatory_review;
  document.canChangeVisibility = row.can_change_visibility;
  return document;
}

function toGraphQLError(error: unknown): never {
  if (
    error instanceof DocumentVisibilityError ||
    error instanceof ProjectReadOnlyError
  ) {
    throw new GraphQLError(error.message, {
      extensions: { code: error.code, field: error.field ?? null },
    });
  }
  throw error;
}

/**
 * US 4.1 / RF-005: configuracion y consulta de visibilidad documental.
 *
 * - `setDocumentVisibility`: solo PI del proyecto (RolesGuard + membresia).
 * - `projectDocuments`: filtra por rol en el servicio; la administracion
 *   nunca recibe documentos `Team_only`.
 */
@Resolver(() => ProjectDocumentGql)
@UseGuards(SessionGuard, RolesGuard)
export class DocumentsResolver {
  @Mutation(() => ProjectDocumentGql)
  @Roles(ROLES.PRINCIPAL_INVESTIGATOR)
  async setDocumentVisibility(
    @Args('projectId', { type: () => Int }) projectId: number,
    @Args('documentId', { type: () => Int }) documentId: number,
    @Args('visibility', { type: () => DocumentVisibilityGql })
    visibility: DocumentVisibilityGql,
    @CurrentUser() user: AuthenticatedUser,
    @Context() context: { req?: { ip?: string } },
  ): Promise<ProjectDocumentGql> {
    try {
      return toGql(
        await setDocumentVisibility(
          user,
          projectId,
          documentId,
          visibility,
          context.req?.ip ?? 'unknown',
        ),
      );
    } catch (error) {
      toGraphQLError(error);
    }
  }

  @Query(() => [ProjectDocumentGql])
  async projectDocuments(
    @Args('projectId', { type: () => Int }) projectId: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ProjectDocumentGql[]> {
    try {
      const rows = await listProjectDocuments(user, projectId);
      return rows.map(toGql);
    } catch (error) {
      toGraphQLError(error);
    }
  }
}
