import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  DECISION_REPORT_INITIAL_DELAY_MS,
  resolveDecisionReportIntervalMs,
} from './decision-report.constants.js';
import { processPendingDecisionReports } from './decision-report.service.js';

/**
 * F1-10 / RF-019: worker in-process del dictamen PDF.
 *
 * El volumen academico no justifica una cola externa (decision D-05 del
 * plan): un barrido periodico de la tabla `Decision_Report` basta. La
 * decision ya quedo guardada; este job solo materializa el PDF.
 */
@Injectable()
export class DecisionReportScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DecisionReportScheduler.name);
  private initialTimer?: NodeJS.Timeout;
  private timer?: NodeJS.Timeout;
  private running = false;

  onModuleInit(): void {
    const intervalMs = resolveDecisionReportIntervalMs();

    this.initialTimer = setTimeout(() => {
      void this.run('arranque');
    }, DECISION_REPORT_INITIAL_DELAY_MS);
    this.initialTimer.unref?.();

    this.timer = setInterval(() => {
      void this.run('programado');
    }, intervalMs);
    this.timer.unref?.();

    this.logger.log(
      `Dictamenes PDF (RF-019) activos; intervalo: ${intervalMs} ms.`,
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
      this.logger.debug(`Dictamenes (${trigger}): ejecucion en curso.`);
      return;
    }
    this.running = true;
    try {
      const summary = await processPendingDecisionReports();
      if (summary.scanned > 0) {
        this.logger.log(
          `Dictamenes (${trigger}): ${summary.ready} listos, ` +
            `${summary.failed} fallidos de ${summary.scanned} revisados.`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Fallo el worker de dictamenes (${trigger}).`,
        error as Error,
      );
    } finally {
      this.running = false;
    }
  }
}
