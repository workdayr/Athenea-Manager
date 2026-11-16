import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => {
  const prisma = {
    notification: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    email_Outbox: {
      create: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
  };
  return { prismaMock: prisma };
});

vi.mock('../db/prisma.js', () => ({ prisma: prismaMock }));

import {
  NotificationsService,
  notifyRole,
  notifyUser,
} from './notifications.service.js';

const notificationRow = {
  notification_id: 12,
  type: 'Decision',
  title: 'Decision del comite',
  message: 'Tu proyecto fue aprobado.',
  link: '/projects/1/documents',
  read_at: null,
  created_at: new Date('2026-11-13T10:00:00.000Z'),
};

beforeEach(() => {
  vi.resetAllMocks();
  prismaMock.notification.create.mockResolvedValue({
    notification_id: 12,
  });
  prismaMock.email_Outbox.create.mockResolvedValue({ email_id: 1 });
});

describe('notifyUser (RF-014)', () => {
  it('persiste la notificacion y encola el correo en el mismo cliente', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'pi@unipolidgo.edu.mx',
    });

    const result = await notifyUser(prismaMock as never, 'user-1', {
      type: 'Decision',
      title: 'Decision del comite',
      message: 'Tu proyecto fue aprobado.',
      link: '/projects/1/documents',
    });

    expect(result).toEqual({ notificationId: 12, emailQueued: true });
    expect(prismaMock.notification.create).toHaveBeenCalledWith({
      data: {
        user_id: 'user-1',
        type: 'Decision',
        title: 'Decision del comite',
        message: 'Tu proyecto fue aprobado.',
        link: '/projects/1/documents',
      },
    });
    expect(prismaMock.email_Outbox.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        notification_id: 12,
        recipient: 'pi@unipolidgo.edu.mx',
        subject: '[Athenea Manager] Decision del comite',
      }),
    });
  });

  it('no falla si el usuario ya no existe', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    const result = await notifyUser(prismaMock as never, 'missing', {
      type: 'System',
      title: 'Aviso',
      message: 'Mensaje',
    });

    expect(result).toBeNull();
    expect(prismaMock.notification.create).not.toHaveBeenCalled();
  });
});

describe('notifyRole (RF-014)', () => {
  it('crea una notificacion y un correo por cada usuario del rol', async () => {
    prismaMock.user.findMany.mockResolvedValue([
      { id: 'admin-1', email: 'admin1@unipolidgo.edu.mx' },
      { id: 'admin-2', email: 'admin2@unipolidgo.edu.mx' },
    ]);
    prismaMock.notification.create
      .mockResolvedValueOnce({ notification_id: 21 })
      .mockResolvedValueOnce({ notification_id: 22 });

    const results = await notifyRole(prismaMock as never, 'ADMINISTRATOR', {
      type: 'Archive',
      title: 'Fallo de archivado',
      message: 'No se pudo archivar el proyecto 5.',
    });

    expect(prismaMock.user.findMany).toHaveBeenCalledWith({
      where: { role: 'ADMINISTRATOR' },
      select: { id: true, email: true },
    });
    expect(results).toHaveLength(2);
    expect(prismaMock.notification.create).toHaveBeenCalledTimes(2);
    expect(prismaMock.email_Outbox.create).toHaveBeenCalledTimes(2);
  });
});

describe('NotificationsService (RF-014)', () => {
  const service = new NotificationsService();

  it('lista solo las notificaciones del usuario con paginacion', async () => {
    prismaMock.notification.findMany.mockResolvedValue([notificationRow]);
    prismaMock.notification.count
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(2);

    const page = await service.listForUser('user-1', {
      page: 2,
      pageSize: 10,
    });

    expect(prismaMock.notification.findMany).toHaveBeenCalledWith({
      where: { user_id: 'user-1' },
      orderBy: { created_at: 'desc' },
      skip: 10,
      take: 10,
    });
    expect(page).toMatchObject({
      total: 3,
      page: 2,
      pageSize: 10,
      unreadCount: 2,
    });
    expect(page.items).toHaveLength(1);
  });

  it('filtra no leidas y acota el tamano de pagina', async () => {
    prismaMock.notification.findMany.mockResolvedValue([]);
    prismaMock.notification.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);

    const page = await service.listForUser('user-1', {
      unreadOnly: true,
      pageSize: 500,
    });

    expect(prismaMock.notification.findMany).toHaveBeenCalledWith({
      where: { user_id: 'user-1', read_at: null },
      orderBy: { created_at: 'desc' },
      skip: 0,
      take: 50,
    });
    expect(page.pageSize).toBe(50);
  });

  it('rechaza paginas invalidas', async () => {
    await expect(service.listForUser('user-1', { page: 0 })).rejects.toMatchObject(
      { extensions: { code: 'VALIDATION_ERROR' } },
    );
  });

  it('marca leida solo una notificacion propia', async () => {
    prismaMock.notification.findFirst.mockResolvedValue(notificationRow);
    prismaMock.notification.update.mockResolvedValue({
      ...notificationRow,
      read_at: new Date(),
    });

    await expect(service.markRead('user-1', 12)).resolves.toBe(true);
    expect(prismaMock.notification.findFirst).toHaveBeenCalledWith({
      where: { notification_id: 12, user_id: 'user-1' },
    });
    expect(prismaMock.notification.update).toHaveBeenCalledWith({
      where: { notification_id: 12 },
      data: { read_at: expect.any(Date) },
    });
  });

  it('no permite marcar como leida una notificacion ajena', async () => {
    prismaMock.notification.findFirst.mockResolvedValue(null);

    await expect(service.markRead('user-2', 12)).rejects.toMatchObject({
      extensions: { code: 'NOT_FOUND' },
    });
    expect(prismaMock.notification.update).not.toHaveBeenCalled();
  });

  it('marca todas las no leidas del usuario', async () => {
    prismaMock.notification.updateMany.mockResolvedValue({ count: 4 });

    await expect(service.markAllRead('user-1')).resolves.toBe(4);
    expect(prismaMock.notification.updateMany).toHaveBeenCalledWith({
      where: { user_id: 'user-1', read_at: null },
      data: { read_at: expect.any(Date) },
    });
  });
});
