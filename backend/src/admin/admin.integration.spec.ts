import 'dotenv/config';
import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../db/prisma.js';
import type { AuthenticatedUser } from '../projects/session.guard.js';
import { listUsers, updateUserRole } from './admin.service.js';

/**
 * Integración real contra PostgreSQL del cambio de rol (F1-07 / RF-001):
 * actualización, auditoría `ROLE_CHANGE`, notificación in-app y correo
 * encolado, además de los rechazos de rol inválido, usuario inexistente y
 * actor sin permisos.
 *
 * Los usuarios son únicos por ejecución y se eliminan en `afterAll`. Si la
 * base no está disponible las pruebas se omiten.
 */

let dbReady = false;
try {
  await prisma.$queryRaw`SELECT 1`;
  dbReady = true;
} catch {
  dbReady = false;
}

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const createdUserIds: string[] = [];
const createdEmails: string[] = [];

async function createUser(
  role: 'ADMINISTRATOR' | 'STUDENT' | 'COORDINATOR',
  label: string,
): Promise<AuthenticatedUser> {
  const id = `it-role-${label}-${suffix}`;
  const email = `${id}@unipolidgo.edu.mx`;
  const name = `Prueba ${label}`;
  await prisma.user.create({ data: { id, name, email, role } });
  createdUserIds.push(id);
  createdEmails.push(email);
  return { id, email, name, role };
}

afterAll(async () => {
  if (!dbReady) {
    return;
  }
  await prisma.email_Outbox.deleteMany({
    where: { recipient: { in: createdEmails } },
  });
  await prisma.notification.deleteMany({
    where: { user_id: { in: createdUserIds } },
  });
  await prisma.audit_Log.deleteMany({
    where: {
      OR: [
        { actor_id: { in: createdUserIds } },
        { target_id: { in: createdUserIds } },
      ],
    },
  });
  await prisma.project_User.deleteMany({
    where: { user_id: { in: createdUserIds } },
  });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.$disconnect();
});

describe.skipIf(!dbReady)('Cambio de rol (integración, F1-07)', () => {
  it('actualiza el rol, audita ROLE_CHANGE y notifica al usuario', async () => {
    const actor = await createUser('ADMINISTRATOR', 'actor');
    const target = await createUser('STUDENT', 'objetivo');

    const updated = await updateUserRole(
      actor,
      target.id,
      'COORDINATOR',
      '127.0.0.1',
    );
    expect(updated.role).toBe('COORDINATOR');

    const stored = await prisma.user.findUnique({
      where: { id: target.id },
      select: { role: true },
    });
    expect(stored?.role).toBe('COORDINATOR');

    const audit = await prisma.audit_Log.findFirst({
      where: {
        actor_id: actor.id,
        action: 'ROLE_CHANGE',
        target_id: target.id,
      },
    });
    expect(audit).not.toBeNull();
    expect(audit?.source_ip).toBe('127.0.0.1');

    const notification = await prisma.notification.findFirst({
      where: { user_id: target.id, type: 'Role' },
    });
    expect(notification).not.toBeNull();
    expect(notification?.title).toContain('rol');
    expect(notification?.message).toContain('Coordinador');

    const outbox = await prisma.email_Outbox.findFirst({
      where: { notification_id: notification?.notification_id },
    });
    expect(outbox?.recipient).toBe(target.email);
    expect(outbox?.status).toBe('Pending');
  });

  it('es idempotente cuando el rol no cambia (sin auditoría nueva)', async () => {
    const actor = await createUser('ADMINISTRATOR', 'actor-idem');
    const target = await createUser('STUDENT', 'objetivo-idem');

    const before = await prisma.audit_Log.count({
      where: { actor_id: actor.id, action: 'ROLE_CHANGE' },
    });
    const updated = await updateUserRole(
      actor,
      target.id,
      'STUDENT',
      '127.0.0.1',
    );
    const after = await prisma.audit_Log.count({
      where: { actor_id: actor.id, action: 'ROLE_CHANGE' },
    });

    expect(updated.role).toBe('STUDENT');
    expect(after).toBe(before);
  });

  it('rechaza roles inválidos con VALIDATION_ERROR', async () => {
    const actor = await createUser('ADMINISTRATOR', 'actor-invalido');
    const target = await createUser('STUDENT', 'objetivo-invalido');

    await expect(
      updateUserRole(actor, target.id, 'SUPER_ADMIN', '127.0.0.1'),
    ).rejects.toMatchObject({ extensions: { code: 'VALIDATION_ERROR' } });
  });

  it('rechaza usuarios inexistentes con NOT_FOUND', async () => {
    const actor = await createUser('ADMINISTRATOR', 'actor-404');

    await expect(
      updateUserRole(actor, `no-existe-${suffix}`, 'COORDINATOR', '127.0.0.1'),
    ).rejects.toMatchObject({ extensions: { code: 'NOT_FOUND' } });
  });

  it('rechaza actores sin rol administrativo con FORBIDDEN', async () => {
    const actor = await createUser('COORDINATOR', 'actor-forbidden');
    const target = await createUser('STUDENT', 'objetivo-forbidden');

    await expect(
      updateUserRole(actor, target.id, 'COORDINATOR', '127.0.0.1'),
    ).rejects.toMatchObject({ extensions: { code: 'FORBIDDEN' } });

    const stored = await prisma.user.findUnique({
      where: { id: target.id },
      select: { role: true },
    });
    expect(stored?.role).toBe('STUDENT');
  });

  it('lista y filtra usuarios por rol y búsqueda', async () => {
    const actor = await createUser('ADMINISTRATOR', 'actor-lista');
    const target = await createUser('STUDENT', 'objetivo-lista');

    // El servicio de listado es la base de la query `users` (guardada por
    // RolesGuard en GraphQL).
    const page = await listUsers(
      { role: 'STUDENT', search: target.email },
      1,
      20,
    );
    expect(page.total).toBeGreaterThanOrEqual(1);
    expect(page.items.some((user) => user.id === target.id)).toBe(true);
    expect(page.items.some((user) => user.id === actor.id)).toBe(false);
    expect(page.items.every((user) => user.role === 'STUDENT')).toBe(true);
  });
});
