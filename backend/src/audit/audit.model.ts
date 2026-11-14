import {
  Field,
  GraphQLISODateTime,
  ID,
  InputType,
  Int,
  ObjectType,
} from '@nestjs/graphql';

@InputType()
export class AuditLogFiltersInput {
  @Field(() => String, { nullable: true })
  actorId?: string;

  @Field(() => String, { nullable: true })
  action?: string;

  @Field(() => String, { nullable: true })
  targetId?: string;

  @Field(() => GraphQLISODateTime, { nullable: true })
  from?: Date;

  @Field(() => GraphQLISODateTime, { nullable: true })
  to?: Date;
}

@ObjectType()
export class AuditLogGql {
  @Field(() => ID)
  logId!: number;

  @Field()
  actorId!: string;

  @Field()
  actorName!: string;

  @Field()
  action!: string;

  @Field()
  targetId!: string;

  @Field()
  sourceIp!: string;

  @Field(() => GraphQLISODateTime)
  timestamp!: Date;
}

@ObjectType()
export class AuditLogPageGql {
  @Field(() => [AuditLogGql])
  items!: AuditLogGql[];

  @Field(() => Int)
  total!: number;

  @Field(() => Int)
  page!: number;

  @Field(() => Int)
  pageSize!: number;
}
