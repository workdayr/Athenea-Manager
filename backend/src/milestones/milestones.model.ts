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
  @Field() assigneeName!: string;
  @Field(() => GraphQLISODateTime) dueDate!: Date;
  @Field(() => GraphQLISODateTime) createdAt!: Date;
  @Field(() => MilestoneStatus) status!: MilestoneStatus;
}

/** US 5.1: integrante del equipo, candidato valido a responsable de un hito. */
@ObjectType()
export class MilestoneTeamMemberGql {
  @Field(() => ID) userId!: string;
  @Field() name!: string;
  @Field() email!: string;
  @Field({ description: 'Principal_Investigator | Co_Investigator | Assistant' })
  projectRole!: string;
}
