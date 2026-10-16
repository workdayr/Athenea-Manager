import { UseGuards } from '@nestjs/common';
import { Args, Context, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GraphQLError } from 'graphql';
import { ROLES } from '../auth/roles.constants.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { CurrentUser } from '../projects/current-user.decorator.js';
import {
  SessionGuard,
  type AuthenticatedUser,
} from '../projects/session.guard.js';
import {
  ConflictGql,
  ConflictStatusGql,
  DecisionResultGql,
  EvaluationDecisionGql,
  EvaluationRecordGql,
  ProposalContextGql,
  ProposalSummaryGql,
  ResolveConflictInput,
  SubmitDecisionInput,
  TeamMemberGql,
} from './proposal-evaluation.model.js';
import {
  EvaluationError,
  pendingConflictReviews,
  proposalContext,
  proposalsPendingReview,
  resolveConflictReview,
  submitProjectDecision,
  type ConflictWithNames,
  type ProposalContext,
} from './proposal-evaluation.service.js';
import { UNKNOWN_ACTOR_IP } from './proposal-evaluation.constants.js';

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
  return ctx.req?.ip ?? first ?? UNKNOWN_ACTOR_IP;
}

function toGraphQLError(error: unknown): never {
  if (error instanceof EvaluationError) {
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

function toSummary(row: {
  project_id: number;
  title: string;
  status: string;
  hasConflict: boolean;
  matchedSurnames: string[];
  conflictStatus: string | null;
}): ProposalSummaryGql {
  const summary = new ProposalSummaryGql();
  summary.projectId = row.project_id;
  summary.title = row.title;
  summary.status = row.status;
  summary.hasConflict = row.hasConflict;
  summary.matchedSurnames = row.matchedSurnames;
  summary.conflictStatus = row.conflictStatus as ConflictStatusGql | null;
  return summary;
}

function toConflict(
  row: ConflictWithNames | NonNullable<ProposalContext['conflict']>,
  projectTitle: string,
  reviewerName: string,
  matchedSurnames: string[],
): ConflictGql {
  const conflict = new ConflictGql();
  conflict.conflictId = row.conflict_id;
  conflict.projectId = row.project_id;
  conflict.projectTitle = projectTitle;
  conflict.reviewerId = row.reviewer_id;
  conflict.reviewerName = reviewerName;
  conflict.status = row.status as ConflictStatusGql;
  conflict.detectedAt = row.detected_at;
  conflict.matchedSurnames = matchedSurnames;
  conflict.resolvedAt = row.resolved_at;
  conflict.resolutionNote = row.resolution_note;
  return conflict;
}

function toContext(
  ctx: ProposalContext,
  reviewerNameById: Map<string, string>,
): ProposalContextGql {
  const detail = new ProposalContextGql();
  detail.projectId = ctx.project_id;
  detail.title = ctx.title;
  detail.objectives = ctx.objectives;
  detail.status = ctx.status;
  detail.startDate = ctx.start_date;
  detail.endDate = ctx.end_date;
  detail.team = ctx.team.map((member) => {
    const item = new TeamMemberGql();
    item.userId = member.user_id;
    item.name = member.name;
    item.email = member.email;
    item.projectRole = member.project_role;
    return item;
  });
  detail.evaluations = ctx.evaluations.map((item) => {
    const record = new EvaluationRecordGql();
    record.evaluationId = item.evaluation_id;
    record.reviewerId = item.reviewer_id;
    record.reviewerName =
      reviewerNameById.get(item.reviewer_id) ?? item.reviewerName;
    record.decision = item.decision as EvaluationDecisionGql;
    record.justification = item.justification;
    record.createdAt = item.created_at;
    return record;
  });
  const conflictRow = ctx.conflict;
  detail.conflict = conflictRow
    ? toConflict(
        conflictRow,
        ctx.title,
        reviewerNameById.get(conflictRow.reviewer_id) ?? '',
        ctx.matchedSurnames,
      )
    : null;
  detail.canEvaluate = ctx.canEvaluate;
  detail.matchedSurnames = ctx.matchedSurnames;
  detail.blockReason = ctx.blockReason;
  return detail;
}

/**
 * Evaluacion de propuestas (RF-019, RF-003, UC-003, BR-011, BR-004).
 *
 * RF-001: decidir/listar exigen COMMITTEE o COORDINATOR (actores de
 * UC-003); resolver alertas exige ADMINISTRATOR (BR-011). Las filas
 * `Review_Conflict` son unicas por (proyecto, evaluador).
 */
@Resolver()
@UseGuards(SessionGuard, RolesGuard)
export class ProposalEvaluationResolver {
  @Query(() => [ProposalSummaryGql])
  @Roles(ROLES.COMMITTEE, ROLES.COORDINATOR)
  async proposalsPendingReview(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ProposalSummaryGql[]> {
    try {
      const rows = await proposalsPendingReview(user);
      return rows.map(toSummary);
    } catch (error) {
      toGraphQLError(error);
    }
  }

  @Query(() => ProposalContextGql)
  @Roles(ROLES.COMMITTEE, ROLES.COORDINATOR)
  async proposalEvaluationContext(
    @Args('projectId', { type: () => Int }) projectId: number,
    @CurrentUser() user: AuthenticatedUser,
    @Context() ctx: GraphQLContext,
  ): Promise<ProposalContextGql> {
    try {
      const detail = await proposalContext(user, projectId, requestIp(ctx));
      const names = new Map<string, string>();
      for (const member of detail.team) {
        names.set(member.user_id, member.name);
      }
      for (const item of detail.evaluations) {
        if (!names.has(item.reviewer_id)) {
          names.set(item.reviewer_id, item.reviewerName);
        }
      }
      return toContext(detail, names);
    } catch (error) {
      toGraphQLError(error);
    }
  }

  @Mutation(() => DecisionResultGql)
  @Roles(ROLES.COMMITTEE, ROLES.COORDINATOR)
  async submitProjectDecision(
    @Args('input') input: SubmitDecisionInput,
    @CurrentUser() user: AuthenticatedUser,
    @Context() ctx: GraphQLContext,
  ): Promise<DecisionResultGql> {
    try {
      const created = (await submitProjectDecision(
        user,
        {
          projectId: input.projectId,
          decision: input.decision,
          justification: input.justification,
        },
        requestIp(ctx),
      )) as unknown as {
        evaluation_id: number;
        project_id: number;
        decision: string;
        newStatus: string;
      };
      const result = new DecisionResultGql();
      result.evaluationId = created.evaluation_id;
      result.projectId = created.project_id;
      result.status = created.newStatus;
      result.decision = created.decision as EvaluationDecisionGql;
      return result;
    } catch (error) {
      toGraphQLError(error);
    }
  }

  @Query(() => [ConflictGql])
  @Roles(ROLES.ADMINISTRATOR)
  async pendingConflictReviews(): Promise<ConflictGql[]> {
    try {
      const rows = await pendingConflictReviews();
      return rows.map((row) =>
        toConflict(row, row.projectTitle, row.reviewerName, row.matchedSurnames),
      );
    } catch (error) {
      toGraphQLError(error);
    }
  }

  @Mutation(() => ConflictGql)
  @Roles(ROLES.ADMINISTRATOR)
  async resolveConflictReview(
    @Args('input') input: ResolveConflictInput,
    @CurrentUser() user: AuthenticatedUser,
    @Context() ctx: GraphQLContext,
  ): Promise<ConflictGql> {
    try {
      const updated = await resolveConflictReview(
        user,
        {
          conflictId: input.conflictId,
          resolution: input.resolution,
          note: input.note,
        },
        requestIp(ctx),
      );
      return toConflict(
        updated,
        updated.projectTitle,
        updated.reviewerName,
        updated.matchedSurnames,
      );
    } catch (error) {
      toGraphQLError(error);
    }
  }
}
