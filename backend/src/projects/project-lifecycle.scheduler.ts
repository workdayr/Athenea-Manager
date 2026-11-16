import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  REVIEW_SLA_INITIAL_DELAY_MS,
  resolveSlaIntervalMs,
} from './project-lifecycle.constants.js';
import { ProjectLifecycleService } from './project-lifecycle.service.js';

/**
 * F1-02: job diario que detecta proyectos Under_Review > 30 dias y avisa a
 * los administradores. La marca `sla_notified_at` hace el job idempotente
 * y seguro ante multiples instancias.
 */
@Injectable()
export class ProjectSlaScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ProjectSlaScheduler.name);
  private initialTimer?: NodeJS.Timeout;
  private timer?: NodeJS.Timeout;

  constructor(private readonly lifecycle: ProjectLifecycleService) {}

  onModuleInit(): void {
    const intervalMs = resolveSlaIntervalMs();

    this.initialTimer = setTimeout(() => {
      void this.run('arranque');
    }, REVIEW_SLA_INITIAL_DELAY_MS);
    this.initialTimer.unref?.();

    this.timer = setInterval(() => {
      void this.run('programado');
    }, intervalMs);
    this.timer.unref?.();

    this.logger.log(
      `SLA de revision (F1-02) activo; intervalo: ${intervalMs} ms.`,
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
      const summary = await this.lifecycle.runSlaScan();
      if (summary.scanned > 0) {
        this.logger.log(
          `SLA (${trigger}): ${summary.notified} avisos de ${summary.scanned} proyectos revisados.`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Fallo el job de SLA de revision (${trigger}).`,
        error as Error,
      );
    }
  }
}
