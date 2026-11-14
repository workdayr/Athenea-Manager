import {
  Field,
  ID,
  InputType,
  Int,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import { GraphQLISODateTime } from '@nestjs/graphql';

export enum EvaluationDecisionGql {
  Approved = 'Approved',
  Rejected = 'Rejected',
  Revision_Required = 'Revision_Required',
}

registerEnumType(EvaluationDecisionGql, { name: 'EvaluationDecision' });

export enum ConflictStatusGql {
  Pending = 'Pending',
  Cleared = 'Cleared',
  Confirmed = 'Confirmed',
}

registerEnumType(ConflictStatusGql, { name: 'ConflictStatus' });

/** F1-10 / RF-019: estado de generacion del dictamen PDF. */
export enum DecisionReportStatusGql {
  Pending = 'Pending',
  Ready = 'Ready',
  Failed = 'Failed',
}

registerEnumType(DecisionReportStatusGql, {
  name: 'DecisionReportStatus',
});

@ObjectType()
export class TeamMemberGql {
  @Field(() => ID)
  userId!: string;

  @Field()
  name!: string;

  @Field()
  email!: string;

  @Field()
  projectRole!: string;
}

@ObjectType()
export class EvaluationRecordGql {
  @Field(() => ID)
  evaluationId!: number;

  @Field()
  reviewerId!: string;

  @Field()
  reviewerName!: string;

  @Field(() => EvaluationDecisionGql)
  decision!: EvaluationDecisionGql;

  @Field()
  justification!: string;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;
}

@ObjectType()
export class ConflictGql {
  @Field(() => ID)
  conflictId!: number;

  @Field(() => Int)
  projectId!: number;

  @Field()
  projectTitle!: string;

  @Field()
  reviewerId!: string;

  @Field()
  reviewerName!: string;

  @Field(() => ConflictStatusGql)
  status!: ConflictStatusGql;

  @Field(() => GraphQLISODateTime)
  detectedAt!: Date;

  /** Apellidos coincidentes (computado, no persistido). */
  @Field(() => [String])
  matchedSurnames!: string[];

  @Field(() => GraphQLISODateTime, { nullable: true })
  resolvedAt!: Date | null;

  @Field(() => String, { nullable: true })
  resolutionNote!: string | null;
}

@ObjectType()
export class ProposalSummaryGql {
  @Field(() => ID)
  projectId!: number;

  @Field()
  title!: string;

  @Field()
  status!: string;

  @Field()
  hasConflict!: boolean;

  @Field(() => [String])
  matchedSurnames!: string[];

  @Field(() => ConflictStatusGql, { nullable: true })
  conflictStatus!: ConflictStatusGql | null;
}

@ObjectType()
export class ProposalContextGql {
  @Field(() => ID)
  projectId!: number;

  @Field()
  title!: string;

  @Field()
  objectives!: string;

  @Field()
  status!: string;

  @Field(() => GraphQLISODateTime)
  startDate!: Date;

  @Field(() => GraphQLISODateTime)
  endDate!: Date;

  @Field(() => [TeamMemberGql])
  team!: TeamMemberGql[];

  /** Historial formal de decisiones (RF-004), mas reciente primero. */
  @Field(() => [EvaluationRecordGql])
  evaluations!: EvaluationRecordGql[];

  @Field(() => ConflictGql, { nullable: true })
  conflict!: ConflictGql | null;

  @Field()
  canEvaluate!: boolean;

  @Field(() => [String])
  matchedSurnames!: string[];

  /** Motivo de bloqueo legible por maquina (null si puede evaluar). */
  @Field(() => String, { nullable: true })
  blockReason!: string | null;
}

@ObjectType()
export class DecisionReportGql {
  @Field(() => ID)
  reportId!: number;

  @Field(() => Int)
  evaluationId!: number;

  @Field(() => DecisionReportStatusGql)
  status!: DecisionReportStatusGql;

  @Field(() => GraphQLISODateTime, { nullable: true })
  readyAt!: Date | null;

  /** Motivo del fallo (solo visible mientras el dictamen no esta listo). */
  @Field(() => String, { nullable: true })
  error!: string | null;

  @Field(() => Int)
  attempts!: number;
}

@ObjectType()
export class DecisionResultGql {
  @Field(() => ID)
  evaluationId!: number;

  @Field(() => Int)
  projectId!: number;

  @Field()
  status!: string;

  @Field(() => EvaluationDecisionGql)
  decision!: EvaluationDecisionGql;
}

@InputType()
export class SubmitDecisionInput {
  @Field(() => Int)
  projectId!: number;

  @Field(() => EvaluationDecisionGql)
  decision!: EvaluationDecisionGql;

  @Field()
  justification!: string;
}

@InputType()
export class ResolveConflictInput {
  @Field(() => Int)
  conflictId!: number;

  @Field(() => ConflictStatusGql)
  resolution!: ConflictStatusGql;

  @Field()
  note!: string;
}
