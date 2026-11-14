import { UseGuards } from '@nestjs/common';
import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { RolesGuard } from '../auth/roles.guard.js';
import { CurrentUser } from '../projects/current-user.decorator.js';
import {
  SessionGuard,
  type AuthenticatedUser,
} from '../projects/session.guard.js';
import { PageInfoGql } from '../common/pagination/pagination.model.js';
import { buildPageInfo, toPageInfoGql } from '../common/pagination/pagination.policy.js';
import {
  NotificationGql,
  NotificationPageGql,
  NotificationTypeGql,
} from './notifications.model.js';
import {
  NotificationsService,
  type NotificationPage,
} from './notifications.service.js';

function toGql(row: NotificationPage['items'][number]): NotificationGql {
  const item = new NotificationGql();
  item.notificationId = row.notification_id;
  item.type = row.type as NotificationTypeGql;
  item.title = row.title;
  item.message = row.message;
  item.link = row.link;
  item.readAt = row.read_at;
  item.createdAt = row.created_at;
  return item;
}

/**
 * RF-014: bandeja personal de notificaciones. Cualquier usuario autenticado
 * puede consultar y marcar solo SUS notificaciones; el servicio filtra por
 * `user_id` para que el aislamiento no dependa del cliente.
 */
@Resolver()
@UseGuards(SessionGuard, RolesGuard)
export class NotificationsResolver {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Query(() => NotificationPageGql)
  async myNotifications(
    @CurrentUser() user: AuthenticatedUser,
    @Args('unreadOnly', {
      type: () => Boolean,
      nullable: true,
      defaultValue: false,
    })
    unreadOnly: boolean,
    @Args('page', { type: () => Int, nullable: true, defaultValue: 1 })
    page: number,
    @Args('pageSize', { type: () => Int, nullable: true, defaultValue: 20 })
    pageSize: number,
  ): Promise<NotificationPageGql> {
    const result = await this.notificationsService.listForUser(user.id, {
      unreadOnly,
      page,
      pageSize,
    });
    const gql = new NotificationPageGql();
    gql.items = result.items.map(toGql);
    gql.total = result.total;
    gql.page = result.page;
    gql.pageSize = result.pageSize;
    gql.pageInfo = toPageInfoGql(
      buildPageInfo(
        { page: result.page, pageSize: result.pageSize },
        result.total,
      ),
      new PageInfoGql(),
    );
    gql.unreadCount = result.unreadCount;
    return gql;
  }

  @Query(() => Int)
  async unreadNotificationCount(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<number> {
    return this.notificationsService.unreadCount(user.id);
  }

  @Mutation(() => Boolean)
  async markNotificationRead(
    @Args('notificationId', { type: () => Int }) notificationId: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<boolean> {
    return this.notificationsService.markRead(user.id, notificationId);
  }

  @Mutation(() => Int)
  async markAllNotificationsRead(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<number> {
    return this.notificationsService.markAllRead(user.id);
  }
}
