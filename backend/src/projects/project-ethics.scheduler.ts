import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  RETENTION_SCAN_INITIAL_DELAY_MS,
  resolveRetentionIntervalMs,
} from './project-ethics.constants.js';
import { ProjectEthicsService } from './project-ethics.service.js';

/**
 * F1-11 / BR-013: job diario de avisos (30 dias antes) y borrado seguro de
 * los datos operativos de proyectos con seres humanos.
 */
@Injectable()
export class ProjectRetentionScheduler
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(ProjectRetentionScheduler.name);
  private initialTimer?: NodeJS.Timeout;
  private timer?: NodeJS.Timeout;

  constructor(private readonly ethics: ProjectEthicsService) {}

  onModuleInit(): void {
    const intervalMs = resolveRetentionIntervalMs();

    this.initialTimer = setTimeout(() => {
      void this.run('arranque');
    }, RETENTION_SCAN_INITIAL_DELAY_MS);
    this.initialTimer.unref?.();

    this.timer = setInterval(() => {
      void this.run('programado');
    }, intervalMs);
    this.timer.unref?.();

    this.logger.log(
      `Retencion de datos (F1-11) activa; intervalo: ${intervalMs} ms.`,
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
    try {
      const summary = await this.ethics.runRetentionScan();
      if (summary.scanned > 0) {
        this.logger.log(
          `Retencion (${trigger}): ${summary.noticesSent} avisos, ` +
            `${summary.deleted} borrados, ${summary.failed} fallidos ` +
            `de ${summary.scanned} revisados.`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Fallo el job de retencion (${trigger}).`,
        error as Error,
      );
    }
  }
}
