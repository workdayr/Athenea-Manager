import { Field, Int, ObjectType, registerEnumType } from '@nestjs/graphql';

export enum MilestoneStatusGql {
  Pending = 'Pending',
  Completed = 'Completed',
  Delayed = 'Delayed',
}

registerEnumType(MilestoneStatusGql, { name: 'MilestoneStatus' });

@ObjectType('Milestone')
export class MilestoneGql {
  @Field(() => Int)
  milestoneId!: number;

  @Field(() => Int)
  projectId!: number;

  @Field()
  name!: string;

  @Field({ description: 'user.id del integrante responsable.' })
  assigneeId!: string;

  @Field()
  assigneeName!: string;

  @Field(() => Date)
  dueDate!: Date;

  @Field(() => MilestoneStatusGql)
  status!: MilestoneStatusGql;
}

@ObjectType('ProjectTeamMember')
export class ProjectTeamMemberGql {
  @Field()
  userId!: string;

  @Field()
  name!: string;

  @Field()
  email!: string;

  @Field({ description: 'Principal_Investigator | Co_Investigator | Assistant' })
  projectRole!: string;
}
