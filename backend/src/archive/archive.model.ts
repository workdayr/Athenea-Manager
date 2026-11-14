import {
  Field,
  ID,
  Int,
  ObjectType,
} from '@nestjs/graphql';
import { GraphQLISODateTime } from '@nestjs/graphql';
import { PageInfoGql } from '../common/pagination/pagination.model.js';

@ObjectType()
export class ArchivedProjectGql {
  @Field(() => Int)
  projectId!: number;

  @Field()
  title!: string;

  @Field()
  status!: string;

  @Field(() => GraphQLISODateTime)
  archivedAt!: Date;

  @Field()
  snapshotHash!: string;
}

@ObjectType()
export class ArchivedProjectPageGql {
  @Field(() => [ArchivedProjectGql])
  items!: ArchivedProjectGql[];

  @Field(() => Int)
  total!: number;

  @Field(() => Int)
  page!: number;

  @Field(() => Int)
  pageSize!: number;

  @Field(() => PageInfoGql)
  pageInfo!: PageInfoGql;
}

@ObjectType()
export class ArchiveAlertGql {
  @Field(() => ID)
  alertId!: number;

  /** null cuando falla el job completo, no un proyecto concreto. */
  @Field(() => Int, { nullable: true })
  projectId!: number | null;

  @Field(() => GraphQLISODateTime)
  attemptedAt!: Date;

  @Field()
  errorMessage!: string;

  @Field(() => GraphQLISODateTime, { nullable: true })
  resolvedAt!: Date | null;
}

@ObjectType()
export class ArchiveOutcomeGql {
  /** archived | skipped | failed */
  @Field()
  status!: string;

  @Field(() => Int)
  projectId!: number;

  @Field(() => String, { nullable: true })
  reason!: string | null;

  @Field(() => String, { nullable: true })
  error!: string | null;

  @Field(() => String, { nullable: true })
  snapshotHash!: string | null;

  @Field(() => Int, { nullable: true })
  archiveId!: number | null;
}

@ObjectType()
export class ArchiveBatchResultGql {
  @Field(() => Int)
  scanned!: number;

  @Field(() => Int)
  archived!: number;

  @Field(() => Int)
  skipped!: number;

  @Field(() => Int)
  failed!: number;
}
