import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => {
  const prisma = {
    email_Outbox: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
  };
  return { prismaMock: prisma };
});

vi.mock('../db/prisma.js', () => ({ prisma: prismaMock }));

import { EmailOutboxScheduler } from './email-outbox.scheduler.js';
import type { EmailService } from './email.service.js';

const now = new Date('2026-11-13T12:00:00.000Z');

function scheduler(send: ReturnType<typeof vi.fn>) {
  return new EmailOutboxScheduler({ send } as unknown as EmailService);
}

function outboxRow(overrides: Record<string, unknown> = {}) {
  return {
    email_id: 1,
    recipient: 'pi@unipolidgo.edu.mx',
    subject: 'Decision del comite',
    body: 'Tu proyecto fue aprobado.',
    attempts: 0,
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  delete process.env['EMAIL_OUTBOX_MAX_ATTEMPTS'];
  prismaMock.email_Outbox.update.mockResolvedValue({ email_id: 1 });
});

describe('EmailOutboxScheduler (RF-014)', () => {
  it('marca como Sent el correo entregado', async () => {
    prismaMock.email_Outbox.findMany.mockResolvedValue([outboxRow()]);
    const send = vi.fn().mockResolvedValue({ status: 'sent' });

    const summary = await scheduler(send).processPendingEmails(now);

    expect(summary).toMatchObject({ scanned: 1, sent: 1 });
    expect(send).toHaveBeenCalledWith({
      to: 'pi@unipolidgo.edu.mx',
      subject: 'Decision del comite',
      text: 'Tu proyecto fue aprobado.',
    });
    expect(prismaMock.email_Outbox.update).toHaveBeenCalledWith({
      where: { email_id: 1 },
      data: {
        status: 'Sent',
        attempts: 1,
        sent_at: now,
        error: null,
      },
    });
  });

  it('marca como Skipped cuando no hay SMTP configurado', async () => {
    prismaMock.email_Outbox.findMany.mockResolvedValue([outboxRow()]);
    const send = vi.fn().mockResolvedValue({
      status: 'skipped',
      reason: 'SMTP no configurado.',
    });

    const summary = await scheduler(send).processPendingEmails(now);

    expect(summary).toMatchObject({ scanned: 1, skipped: 1 });
    expect(prismaMock.email_Outbox.update).toHaveBeenCalledWith({
      where: { email_id: 1 },
      data: {
        status: 'Skipped',
        attempts: 1,
        error: 'SMTP no configurado.',
      },
    });
  });

  it('reintenta con backoff si el fallo es transitorio', async () => {
    prismaMock.email_Outbox.findMany.mockResolvedValue([outboxRow()]);
    const send = vi.fn().mockResolvedValue({
      status: 'failed',
      error: 'ECONNREFUSED',
    });

    const summary = await scheduler(send).processPendingEmails(now);

    expect(summary).toMatchObject({ scanned: 1, retrying: 1 });
    const update = prismaMock.email_Outbox.update.mock.calls[0][0] as {
      data: { status: string; attempts: number; next_attempt_at: Date };
    };
    expect(update.data.status).toBe('Pending');
    expect(update.data.attempts).toBe(1);
    expect(update.data.next_attempt_at.getTime()).toBeGreaterThan(now.getTime());
  });

  it('marca como Failed al alcanzar el maximo de intentos', async () => {
    prismaMock.email_Outbox.findMany.mockResolvedValue([
      outboxRow({ attempts: 4 }),
    ]);
    const send = vi.fn().mockResolvedValue({
      status: 'failed',
      error: 'ECONNREFUSED',
    });

    const summary = await scheduler(send).processPendingEmails(now);

    expect(summary).toMatchObject({ scanned: 1, failed: 1 });
    expect(prismaMock.email_Outbox.update).toHaveBeenCalledWith({
      where: { email_id: 1 },
      data: {
        status: 'Failed',
        attempts: 5,
        error: 'ECONNREFUSED',
      },
    });
  });

  it('solo consulta correos Pending vencidos', async () => {
    prismaMock.email_Outbox.findMany.mockResolvedValue([]);
    const send = vi.fn();

    const summary = await scheduler(send).processPendingEmails(now);

    expect(summary).toEqual({
      scanned: 0,
      sent: 0,
      skipped: 0,
      retrying: 0,
      failed: 0,
    });
    expect(prismaMock.email_Outbox.findMany).toHaveBeenCalledWith({
      where: { status: 'Pending', next_attempt_at: { lte: now } },
      orderBy: { next_attempt_at: 'asc' },
      take: expect.any(Number),
    });
    expect(send).not.toHaveBeenCalled();
  });
});
