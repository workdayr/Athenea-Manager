import { Injectable } from '@nestjs/common';
import { GraphQLError } from 'graphql';
import { prisma } from '../db/prisma.js';
import type {
  NotificationType,
  Prisma,
} from '../generated/prisma/client.js';
import {
  NOTIFICATION_ERROR_CODES,
  NOTIFICATION_LINK_MAX_LENGTH,
  NOTIFICATION_MESSAGE_MAX_LENGTH,
  NOTIFICATIONS_PAGE_SIZE_DEFAULT,
  NOTIFICATIONS_PAGE_SIZE_MAX,
  NOTIFICATION_TITLE_MAX_LENGTH,
} from './notifications.constants.js';

/**
 * Cliente Prisma o transaccion interactiva. Ambos exponen los mismos
 * delegados, de modo que una notificacion puede entrar en la MISMA
 * transaccion que la accion que la origina.
 */
export type NotificationDb = Prisma.TransactionClient;

export interface NotifyInput {
  type: NotificationType;
  title: string;
  message: string;
  link?: string | null;
  /** Asunto del correo; por defecto se usa el titulo. */
  subject?: string;
  /** Cuerpo del correo; por defecto se deriva del mensaje y el enlace. */
  emailBody?: string;
}

export interface NotifyResult {
  notificationId: number;
  emailQueued: boolean;
}

export interface ListNotificationsOptions {
  unreadOnly?: boolean;
  page?: number;
  pageSize?: number;
}

export interface NotificationPage {
  items: {
    notification_id: number;
    type: NotificationType;
    title: string;
    message: string;
    link: string | null;
    read_at: Date | null;
    created_at: Date;
  }[];
  total: number;
  page: number;
  pageSize: number;
  unreadCount: number;
}

function truncate(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}

function emailBody(message: string, link?: string | null): string {
  const origin = (process.env['FRONTEND_ORIGIN'] ?? 'http://localhost:3000')
    .replace(/\/+$/, '');
  const lines = [message];
  if (link) {
    lines.push('', `Abrir en Athenea Manager: ${origin}${link}`);
  }
  lines.push(
    '',
    'Este correo fue generado automaticamente por Athenea Manager.',
  );
  return lines.join('\n');
}

async function createForUser(
  db: NotificationDb,
  user: { id: string; email: string },
  input: NotifyInput,
): Promise<NotifyResult> {
  const title = truncate(input.title, NOTIFICATION_TITLE_MAX_LENGTH);
  const message = truncate(input.message, NOTIFICATION_MESSAGE_MAX_LENGTH);
  const link = input.link
    ? truncate(input.link, NOTIFICATION_LINK_MAX_LENGTH)
    : null;

  const notification = await db.notification.create({
    data: {
      user_id: user.id,
      type: input.type,
      title,
      message,
      link,
    },
  });

  if (!user.email) {
    return { notificationId: notification.notification_id, emailQueued: false };
  }

  await db.email_Outbox.create({
    data: {
      notification_id: notification.notification_id,
      recipient: user.email,
      subject: truncate(
        input.subject ?? `[Athenea Manager] ${title}`,
        300,
      ),
      body: input.emailBody ?? emailBody(message, link),
    },
  });

  return { notificationId: notification.notification_id, emailQueued: true };
}

/** RF-014: notifica a un usuario concreto (in-app + correo encolado). */
export async function notifyUser(
  db: NotificationDb,
  userId: string,
  input: NotifyInput,
): Promise<NotifyResult | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true },
  });
  if (!user) {
    return null;
  }
  return createForUser(db, user, input);
}

/** RF-014: notifica a todos los usuarios de un rol (p. ej. administradores). */
export async function notifyRole(
  db: NotificationDb,
  role: string,
  input: NotifyInput,
): Promise<NotifyResult[]> {
  const users = await db.user.findMany({
    where: { role: role as never },
    select: { id: true, email: true },
  });
  const results: NotifyResult[] = [];
  for (const user of users) {
    results.push(await createForUser(db, user, input));
  }
  return results;
}

function normalizePage(page: number | undefined): number {
  if (page === undefined) {
    return 1;
  }
  if (!Number.isInteger(page) || page < 1) {
    throw new GraphQLError('La pagina debe ser un entero mayor o igual a 1.', {
      extensions: {
        code: NOTIFICATION_ERROR_CODES.VALIDATION_ERROR,
        field: 'page',
      },
    });
  }
  return page;
}

function normalizePageSize(pageSize: number | undefined): number {
  if (pageSize === undefined) {
    return NOTIFICATIONS_PAGE_SIZE_DEFAULT;
  }
  if (!Number.isInteger(pageSize) || pageSize < 1) {
    throw new GraphQLError(
      'El tamano de pagina debe ser un entero mayor o igual a 1.',
      {
        extensions: {
          code: NOTIFICATION_ERROR_CODES.VALIDATION_ERROR,
          field: 'pageSize',
        },
      },
    );
  }
  return Math.min(pageSize, NOTIFICATIONS_PAGE_SIZE_MAX);
}

@Injectable()
export class NotificationsService {
  async listForUser(
    userId: string,
    options: ListNotificationsOptions = {},
  ): Promise<NotificationPage> {
    const page = normalizePage(options.page);
    const pageSize = normalizePageSize(options.pageSize);
    const where = {
      user_id: userId,
      ...(options.unreadOnly ? { read_at: null } : {}),
    };

    const [items, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { user_id: userId, read_at: null } }),
    ]);

    return {
      items: items as unknown as NotificationPage['items'],
      total,
      page,
      pageSize,
      unreadCount,
    };
  }

  async unreadCount(userId: string): Promise<number> {
    return prisma.notification.count({
      where: { user_id: userId, read_at: null },
    });
  }

  async markRead(userId: string, notificationId: number): Promise<boolean> {
    const existing = await prisma.notification.findFirst({
      where: { notification_id: notificationId, user_id: userId },
    });
    if (!existing) {
      throw new GraphQLError('La notificacion no existe.', {
        extensions: { code: NOTIFICATION_ERROR_CODES.NOT_FOUND },
      });
    }
    if (!existing.read_at) {
      await prisma.notification.update({
        where: { notification_id: notificationId },
        data: { read_at: new Date() },
      });
    }
    return true;
  }

  async markAllRead(userId: string): Promise<number> {
    const result = await prisma.notification.updateMany({
      where: { user_id: userId, read_at: null },
      data: { read_at: new Date() },
    });
    return result.count;
  }
}
