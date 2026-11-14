import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { prisma } from '../db/prisma.js';
import {
  EMAIL_OUTBOX_BATCH_SIZE,
  EMAIL_OUTBOX_INITIAL_DELAY_MS,
  nextEmailAttemptAt,
  resolveEmailOutboxIntervalMs,
  resolveEmailOutboxMaxAttempts,
} from './notifications.constants.js';
import { EmailService } from './email.service.js';

interface OutboxRow {
  email_id: number;
  recipient: string;
  subject: string;
  body: string;
  attempts: number;
}

export interface EmailOutboxSummary {
  scanned: number;
  sent: number;
  skipped: number;
  retrying: number;
  failed: number;
}

/**
 * RF-014: job que vacia la cola persistente de correos.
 *
 * La notificacion y su correo se guardan en la misma transaccion que la
 * accion de negocio. Este job los envia fuera de esa transaccion, con
 * reintentos y backoff exponencial; un fallo de SMTP nunca revierte la
 * operacion original.
 */
@Injectable()
export class EmailOutboxScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmailOutboxScheduler.name);
  private initialTimer?: NodeJS.Timeout;
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly emailService: EmailService) {}

  onModuleInit(): void {
    const intervalMs = resolveEmailOutboxIntervalMs();

    this.initialTimer = setTimeout(() => {
      void this.run('arranque');
    }, EMAIL_OUTBOX_INITIAL_DELAY_MS);
    this.initialTimer.unref?.();

    this.timer = setInterval(() => {
      void this.run('programado');
    }, intervalMs);
    this.timer.unref?.();

    this.logger.log(
      `Outbox de correo (RF-014) activa; intervalo: ${intervalMs} ms.`,
    );
  }

  onModuleDestroy(): void {
    if (this.initialTimer) {
      clearTimeout(this.initialTimer);
    }
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  private async run(trigger: string): Promise<void> {
    if (this.running) {
      this.logger.debug(`Outbox (${trigger}): ejecucion anterior en curso.`);
      return;
    }
    this.running = true;
    try {
      const summary = await this.processPendingEmails();
      if (summary.scanned > 0) {
        this.logger.log(
          `Outbox (${trigger}): ${summary.sent} enviados, ` +
            `${summary.skipped} omitidos, ${summary.retrying} reintentos, ` +
            `${summary.failed} fallidos de ${summary.scanned} revisados.`,
        );
      }
    } catch (error) {
      this.logger.error(`Fallo el job de outbox (${trigger}).`, error as Error);
    } finally {
      this.running = false;
    }
  }

  /** Procesa un lote de correos pendientes; expuesto para pruebas. */
  async processPendingEmails(now: Date = new Date()): Promise<EmailOutboxSummary> {
    const maxAttempts = resolveEmailOutboxMaxAttempts();
    const summary: EmailOutboxSummary = {
      scanned: 0,
      sent: 0,
      skipped: 0,
      retrying: 0,
      failed: 0,
    };

    const rows = (await prisma.email_Outbox.findMany({
      where: { status: 'Pending', next_attempt_at: { lte: now } },
      orderBy: { next_attempt_at: 'asc' },
      take: EMAIL_OUTBOX_BATCH_SIZE,
    })) as unknown as OutboxRow[];

    summary.scanned = rows.length;
    for (const row of rows) {
      const attempts = row.attempts + 1;
      const result = await this.emailService.send({
        to: row.recipient,
        subject: row.subject,
        text: row.body,
      });

      if (result.status === 'sent') {
        await prisma.email_Outbox.update({
          where: { email_id: row.email_id },
          data: {
            status: 'Sent',
            attempts,
            sent_at: now,
            error: null,
          },
        });
        summary.sent += 1;
        continue;
      }

      if (result.status === 'skipped') {
        await prisma.email_Outbox.update({
          where: { email_id: row.email_id },
          data: {
            status: 'Skipped',
            attempts,
            error: result.reason,
          },
        });
        summary.skipped += 1;
        continue;
      }

      if (attempts >= maxAttempts) {
        await prisma.email_Outbox.update({
          where: { email_id: row.email_id },
          data: {
            status: 'Failed',
            attempts,
            error: result.error,
          },
        });
        summary.failed += 1;
        continue;
      }

      await prisma.email_Outbox.update({
        where: { email_id: row.email_id },
        data: {
          status: 'Pending',
          attempts,
          error: result.error,
          next_attempt_at: nextEmailAttemptAt(attempts, now),
        },
      });
      summary.retrying += 1;
    }

    return summary;
  }
}
