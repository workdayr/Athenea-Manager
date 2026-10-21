import { Field, Int, ObjectType } from '@nestjs/graphql';
import { MilestoneStatusGql } from '../../milestones/entities/milestone.entity.js';

@ObjectType('Task')
export class TaskGql {
  @Field(() => Int)
  taskId!: number;

  @Field(() => Int)
  milestoneId!: number;

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
