import { Field, InputType, Int } from '@nestjs/graphql';
import {
  IsDate,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';
import { MilestoneStatusGql } from '../entities/milestone.entity.js';

@InputType()
export class CreateMilestoneInput {
  @Field(() => Int)
  @IsInt()
  @IsPositive()
  projectId!: number;

  @Field()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name!: string;

  @Field({ description: 'user.id del responsable (debe ser del equipo).' })
  @IsString()
  @IsNotEmpty()
  assigneeId!: string;

  @Field(() => Date)
  @IsDate()
  dueDate!: Date;

  @Field(() => MilestoneStatusGql)
  @IsEnum(MilestoneStatusGql)
  status!: MilestoneStatusGql;
}
