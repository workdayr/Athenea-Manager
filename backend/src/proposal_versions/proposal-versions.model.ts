import {
  Field,
  GraphQLISODateTime,
  ID,
  Int,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import { ProjectStatusGql } from '../projects/projects.model.js';
import { ProjectDocumentGql } from '../documents/documents.model.js';

/** Dictamen ya emitido sobre una version (null mientras sigue en revision). */
export enum ProposalVersionDecisionGql {
  Approved = 'Approved',
  Rejected = 'Rejected',
  Revision_Required = 'Revision_Required',
}

registerEnumType(ProposalVersionDecisionGql, {
  name: 'ProposalVersionDecision',
  description: 'Dictamen del comite sobre una version de la propuesta.',
});

@ObjectType()
export class ProposalVersionGql {
  @Field(() => ID)
  versionId!: number;

  @Field(() => Int)
  projectId!: number;

  @Field(() => Int)
  versionNumber!: number;

  @Field()
  submittedBy!: string;

  @Field(() => String, { nullable: true })
  submitterName!: string | null;

  @Field(() => GraphQLISODateTime)
  submittedAt!: Date;

  @Field(() => ProjectStatusGql)
  status!: ProjectStatusGql;

  @Field(() => ProposalVersionDecisionGql, { nullable: true })
  decision!: ProposalVersionDecisionGql | null;

  @Field(() => String, { nullable: true })
  submitterComment!: string | null;

  @Field(() => String, { nullable: true })
  committeeComments!: string | null;

  @Field(() => GraphQLISODateTime, { nullable: true })
  decidedAt!: Date | null;

  @Field(() => String, { nullable: true })
  reviewerName!: string | null;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;

  @Field(() => [ProjectDocumentGql])
  documents!: ProjectDocumentGql[];
}

@ObjectType()
export class ProposalVersionStateGql {
  @Field(() => Int)
  projectId!: number;

  @Field(() => Int)
  maxVersions!: number;

  @Field(() => Int)
  versionsUsed!: number;

  @Field(() => Int)
  remainingVersions!: number;

  @Field(() => Int)
  nextVersionNumber!: number;

  @Field()
  canUpload!: boolean;

  @Field(() => String, { nullable: true })
  blockedReason!: string | null;
}
