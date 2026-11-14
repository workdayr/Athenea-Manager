import {
  Field,
  GraphQLISODateTime,
  ID,
  Int,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import { PageInfoGql } from '../common/pagination/pagination.model.js';

/** RF-014: tipos de evento notificables. */
export enum NotificationTypeGql {
  Decision = 'Decision',
  Milestone = 'Milestone',
  Evidence = 'Evidence',
  Archive = 'Archive',
  Role = 'Role',
  Invitation = 'Invitation',
  Deadline = 'Deadline',
  System = 'System',
}

registerEnumType(NotificationTypeGql, { name: 'NotificationType' });

@ObjectType()
export class NotificationGql {
  @Field(() => ID)
  notificationId!: number;

  @Field(() => NotificationTypeGql)
  type!: NotificationTypeGql;

  @Field()
  title!: string;

  @Field()
  message!: string;

  @Field(() => String, { nullable: true })
  link!: string | null;

  @Field(() => GraphQLISODateTime, { nullable: true })
  readAt!: Date | null;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;
}

@ObjectType()
export class NotificationPageGql {
  @Field(() => [NotificationGql])
  items!: NotificationGql[];

  @Field(() => Int)
  total!: number;

  @Field(() => Int)
  page!: number;

  @Field(() => Int)
  pageSize!: number;

  /** F2-03 / RF-013: metadatos de paginacion reutilizables. */
  @Field(() => PageInfoGql)
  pageInfo!: PageInfoGql;

  @Field(() => Int)
  unreadCount!: number;
}
