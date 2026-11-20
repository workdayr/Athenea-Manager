import { UseGuards } from '@nestjs/common';
import { Args, Int, Query, Resolver } from '@nestjs/graphql';
import { GraphQLError } from 'graphql';
import { RolesGuard } from '../auth/roles.guard.js';
import { CurrentUser } from '../projects/current-user.decorator.js';
import { SessionGuard, type AuthenticatedUser } from '../projects/session.guard.js';
import { ProjectReadOnlyError } from '../projects/project-write-guard.js';
import {
  DocTypeGql,
  DocumentReviewStatusGql,
  DocumentVisibilityGql,
  ProjectDocumentGql,
} from '../documents/documents.model.js';
import { ProjectStatusGql } from '../projects/projects.model.js';
import {
  ProposalVersionDecisionGql,
  ProposalVersionGql,
  ProposalVersionStateGql,
} from './proposal-versions.model.js';
import {
  listProposalVersions,
  proposalVersionState,
  ProposalVersionError,
  type ProposalVersionDocumentView,
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

function toDocumentGql(document: ProposalVersionDocumentView): ProjectDocumentGql {
  const gql = new ProjectDocumentGql();
  gql.documentId = document.documentId;
  gql.projectId = document.projectId;
  gql.docType = document.docType as DocTypeGql;
  gql.visibility = document.visibility as DocumentVisibilityGql;
  gql.fileName = document.fileName;
  gql.fileSize = document.fileSize;
  gql.version = document.version;
  gql.uploadedAt = document.uploadedAt;
  gql.mandatoryReview = document.mandatoryReview;
  gql.canChangeVisibility = document.canChangeVisibility;
  gql.reviewStatus = document.reviewStatus as DocumentReviewStatusGql;
  gql.reviewedAt = document.reviewedAt;
  gql.reviewerName = document.reviewerName;
  gql.reviewNotes = document.reviewNotes;
  gql.canReview = document.canReview;
  return gql;
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
  gql.decision = (view.decision as ProposalVersionDecisionGql | null) ?? null;
  gql.submitterComment = view.submitterComment;
  gql.committeeComments = view.committeeComments;
  gql.decidedAt = view.decidedAt;
  gql.reviewerName = view.reviewerName;
  gql.createdAt = view.createdAt;
  gql.documents = view.documents.map(toDocumentGql);
  return gql;
}

@Resolver(() => ProposalVersionGql)
@UseGuards(SessionGuard, RolesGuard)
export class ProposalVersionsResolver {
  @Query(() => [ProposalVersionGql])
  async proposalVersions(
    @Args('projectId', { type: () => Int }) projectId: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ProposalVersionGql[]> {
    try {
      const views = await listProposalVersions(user, projectId);
      return views.map(toProposalVersionGql);
    } catch (error) {
      toGraphQLError(error);
    }
  }

  @Query(() => ProposalVersionStateGql)
  async proposalVersionState(
    @Args('projectId', { type: () => Int }) projectId: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ProposalVersionStateGql> {
    try {
      const state = await proposalVersionState(user, projectId);
      const gql = new ProposalVersionStateGql();
      gql.projectId = state.projectId;
      gql.maxVersions = state.maxVersions;
      gql.versionsUsed = state.versionsUsed;
      gql.remainingVersions = state.remainingVersions;
      gql.nextVersionNumber = state.nextVersionNumber;
      gql.canUpload = state.canUpload;
      gql.blockedReason = state.blockedReason;
      return gql;
    } catch (error) {
      toGraphQLError(error);
    }
  }
}
