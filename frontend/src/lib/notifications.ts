import { gql } from '@apollo/client';
import { getApolloClient } from './apollo-client';

export type NotificationType =
  | 'Decision'
  | 'Milestone'
  | 'Evidence'
  | 'Archive'
  | 'Role'
  | 'Invitation'
  | 'Deadline'
  | 'Retention'
  | 'Sla'
  | 'System';

export interface AppNotification {
  notificationId: string;
  type: NotificationType;
  title: string;
  message: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationPage {
  items: AppNotification[];
  total: number;
  page: number;
  pageSize: number;
  unreadCount: number;
}

const EMPTY_PAGE: NotificationPage = {
  items: [],
  total: 0,
  page: 1,
  pageSize: 0,
  unreadCount: 0,
};

export const MY_NOTIFICATIONS_QUERY = gql`
  query MyNotifications($unreadOnly: Boolean, $page: Int, $pageSize: Int) {
    myNotifications(unreadOnly: $unreadOnly, page: $page, pageSize: $pageSize) {
      items {
        notificationId
        type
        title
        message
        link
        readAt
        createdAt
      }
      total
      page
      pageSize
      unreadCount
    }
  }
`;

export const UNREAD_NOTIFICATION_COUNT_QUERY = gql`
  query UnreadNotificationCount {
    unreadNotificationCount
  }
`;

export const MARK_NOTIFICATION_READ_MUTATION = gql`
  mutation MarkNotificationRead($notificationId: Int!) {
    markNotificationRead(notificationId: $notificationId)
  }
`;

export const MARK_ALL_NOTIFICATIONS_READ_MUTATION = gql`
  mutation MarkAllNotificationsRead {
    markAllNotificationsRead
  }
`;

export async function fetchNotifications(options?: {
  unreadOnly?: boolean;
  page?: number;
  pageSize?: number;
}): Promise<NotificationPage> {
  const { data } = await getApolloClient().query<{
    myNotifications: NotificationPage;
  }>({
    query: MY_NOTIFICATIONS_QUERY,
    variables: {
      unreadOnly: options?.unreadOnly ?? false,
      page: options?.page ?? 1,
      pageSize: options?.pageSize ?? 8,
    },
    fetchPolicy: 'network-only',
  });
  return data?.myNotifications ?? EMPTY_PAGE;
}

export async function fetchUnreadNotificationCount(): Promise<number> {
  const { data } = await getApolloClient().query<{
    unreadNotificationCount: number;
  }>({
    query: UNREAD_NOTIFICATION_COUNT_QUERY,
    fetchPolicy: 'network-only',
  });
  return data?.unreadNotificationCount ?? 0;
}

export async function markNotificationRead(
  notificationId: string,
): Promise<boolean> {
  const { data } = await getApolloClient().mutate<{
    markNotificationRead: boolean;
  }>({
    mutation: MARK_NOTIFICATION_READ_MUTATION,
    variables: { notificationId: Number(notificationId) },
  });
  return data?.markNotificationRead ?? false;
}

export async function markAllNotificationsRead(): Promise<number> {
  const { data } = await getApolloClient().mutate<{
    markAllNotificationsRead: number;
  }>({ mutation: MARK_ALL_NOTIFICATIONS_READ_MUTATION });
  return data?.markAllNotificationsRead ?? 0;
}
