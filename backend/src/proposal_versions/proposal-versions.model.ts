import {
  Field,
  GraphQLISODateTime,
  ID,
  Int,
  ObjectType,
} from '@nestjs/graphql';
import { ProjectStatusGql } from '../projects/projects.model.js';
import { ProjectDocumentGql } from '../documents/documents.model.js';

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

  @Field(() => String, { nullable: true })
  committeeComments!: string | null;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;

  @Field(() => [ProjectDocumentGql])
  documents!: ProjectDocumentGql[];
}
