import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';
import { GraphQLISODateTime } from '@nestjs/graphql';
import { MilestoneStatus } from '../generated/prisma/client.js';

registerEnumType(MilestoneStatus, { name: 'MilestoneStatus' });

@ObjectType()
export class MilestoneGql {
  @Field(() => ID) milestoneId!: number;
  @Field(() => ID) projectId!: number;
  @Field() name!: string;
  @Field(() => ID) assigneeId!: string;
  @Field(() => GraphQLISODateTime) dueDate!: Date;
  @Field(() => MilestoneStatus) status!: MilestoneStatus;
}