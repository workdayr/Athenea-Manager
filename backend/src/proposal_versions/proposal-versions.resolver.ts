import { UseGuards } from '@nestjs/common';
import { Args, Int, Query, Resolver } from '@nestjs/graphql';
import { GraphQLError } from 'graphql';
import { RolesGuard } from '../auth/roles.guard.js';
import { SessionGuard } from '../projects/session.guard.js';
import { ProjectReadOnlyError } from '../projects/project-write-guard.js';
import {
  DocTypeGql,
  DocumentReviewStatusGql,
  DocumentVisibilityGql,
  ProjectDocumentGql,
} from '../documents/documents.model.js';
import { ProjectStatusGql } from '../projects/projects.model.js';
import { ProposalVersionGql } from './proposal-versions.model.js';
import {
  listProposalVersions,
  ProposalVersionError,
  type ProposalVersionView,
} from './proposal-versions.service.js';

function toGraphQLError(error: unknown): never {
  if (
    error instanceof ProposalVersionError ||
    error instanceof ProjectReadOnlyError
  ) {
    throw new GraphQLError(error.message, {
      extensions: { code: error.code, field: error.field ?? null },
    });
  }
  throw error;
}

function toProposalVersionGql(view: ProposalVersionView): ProposalVersionGql {
  const gql = new ProposalVersionGql();
  gql.versionId = view.versionId;
  gql.projectId = view.projectId;
  gql.versionNumber = view.versionNumber;
  gql.submittedBy = view.submittedBy;
  gql.submitterName = view.submitterName;
  gql.submittedAt = view.submittedAt;
  gql.status = view.status as ProjectStatusGql;
  gql.committeeComments = view.committeeComments;
  gql.createdAt = view.createdAt;
  gql.documents = view.documents.map((d) => {
    const docGql = new ProjectDocumentGql();
    docGql.documentId = d.documentId;
    docGql.projectId = d.projectId;
    docGql.docType = d.docType as DocTypeGql;
    docGql.visibility = d.visibility as DocumentVisibilityGql;
    docGql.fileName = d.fileName;
    docGql.fileSize = d.fileSize;
    docGql.version = d.version;
    docGql.uploadedAt = d.uploadedAt;
    docGql.mandatoryReview = d.mandatoryReview;
    docGql.canChangeVisibility = d.canChangeVisibility;
    docGql.reviewStatus = d.reviewStatus as DocumentReviewStatusGql;
    docGql.reviewedAt = d.reviewedAt;
    docGql.reviewerName = d.reviewerName;
    docGql.reviewNotes = d.reviewNotes;
    docGql.canReview = d.canReview;
    return docGql;
  });
  return gql;
}

@Resolver(() => ProposalVersionGql)
@UseGuards(SessionGuard, RolesGuard)
export class ProposalVersionsResolver {
  @Query(() => [ProposalVersionGql])
  async proposalVersions(
    @Args('projectId', { type: () => Int }) projectId: number,
  ): Promise<ProposalVersionGql[]> {
    try {
      const views = await listProposalVersions(projectId);
      return views.map(toProposalVersionGql);
    } catch (error) {
      toGraphQLError(error);
    }
  }
}
