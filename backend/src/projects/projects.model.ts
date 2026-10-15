import {
  Field,
  ID,
  InputType,
  Int,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import { GraphQLISODateTime } from '@nestjs/graphql';

export enum ProjectStatusGql {
  Proposed = 'Proposed',
  Under_Review = 'Under_Review',
  Approved = 'Approved',
  Active = 'Active',
  Completed = 'Completed',
  Closed = 'Closed',
  Rejected = 'Rejected',
  Suspended = 'Suspended',
}

registerEnumType(ProjectStatusGql, { name: 'ProjectStatus' });

@ObjectType()
export class ProjectGql {
  @Field(() => ID)
  projectId!: number;

  @Field()
  title!: string;

  @Field()
  objectives!: string;

  @Field(() => GraphQLISODateTime)
  startDate!: Date;

  @Field(() => GraphQLISODateTime)
  endDate!: Date;

  @Field(() => ProjectStatusGql)
  status!: ProjectStatusGql;

  @Field(() => Int, { nullable: true })
  callId!: number | null;
}

@InputType()
export class RegisterProjectInput {
  @Field()
  title!: string;

  @Field()
  objectives!: string;

  @Field(() => GraphQLISODateTime)
  startDate!: Date;

  @Field(() => GraphQLISODateTime)
  endDate!: Date;

  @Field(() => Int, { nullable: true })
  callId?: number | null;
}
