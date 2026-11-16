import {
  Field,
  ID,
  InputType,
  Int,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import { GraphQLISODateTime } from '@nestjs/graphql';
import { MilestoneStatus } from '../generated/prisma/client.js';

registerEnumType(MilestoneStatus, { name: 'MilestoneStatus' });

@InputType()
export class CreateMilestoneInput {
  @Field(() => Int)
  projectId!: number;

  @Field()
  name!: string;

  @Field(() => ID)
  assigneeId!: string;

  /** Fecha compromiso en formato ISO (YYYY-MM-DD o ISO-8601). */
  @Field()
  dueDate!: string;
}

@InputType()
export class UpdateMilestoneInput {
  @Field(() => String, { nullable: true })
  name?: string;

  @Field(() => String, { nullable: true })
  dueDate?: string;
}

@ObjectType()
export class MilestoneGql {
  @Field(() => ID) milestoneId!: number;
  @Field(() => ID) projectId!: number;
  @Field() name!: string;
  @Field(() => ID) assigneeId!: string;
  @Field() assigneeName!: string;
  @Field(() => GraphQLISODateTime) dueDate!: Date;
  @Field(() => MilestoneStatus) status!: MilestoneStatus;
  @Field(() => GraphQLISODateTime) lastProgressAt!: Date;
}