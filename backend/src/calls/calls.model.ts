import {
  Field,
  ID,
  InputType,
  Int,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import { GraphQLISODateTime } from '@nestjs/graphql';

export enum CallStatusGql {
  DRAFT = 'DRAFT',
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
}

registerEnumType(CallStatusGql, { name: 'CallStatus' });

@ObjectType()
export class CallGql {
  @Field(() => ID)
  callId!: number;

  @Field()
  title!: string;

  @Field()
  description!: string;

  @Field(() => GraphQLISODateTime, { nullable: true })
  datePublished!: Date | null;

  @Field(() => GraphQLISODateTime)
  deadline!: Date;

  @Field(() => Int)
  applicationCap!: number;

  @Field(() => Int)
  applicationCount!: number;

  @Field(() => CallStatusGql)
  status!: CallStatusGql;

  /** Cupos restantes antes del cierre por capacidad. */
  @Field(() => Int)
  remainingSlots!: number;
}

@InputType()
export class CreateCallInput {
  @Field()
  title!: string;

  @Field()
  description!: string;

  @Field(() => GraphQLISODateTime)
  deadline!: Date;

  @Field(() => Int)
  applicationCap!: number;
}
