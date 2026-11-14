import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  MILESTONE_SCAN_INITIAL_DELAY_MS,
  resolveMilestoneScanIntervalMs,
} from './milestones.constants.js';
import { MilestonesService } from './milestones.service.js';

/**
 * BR-008: ejecucion diaria del control de retrasos y avisos de vencimiento.
 * No usa cron externo para que el despliegue siga siendo solo API + web;
 * el intervalo es configurable con `MILESTONE_SCAN_INTERVAL_MS`.
 */
@Injectable()
export class MilestonesScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MilestonesScheduler.name);
  private initialTimer?: NodeJS.Timeout;
  private intervalTimer?: NodeJS.Timeout;

  constructor(private readonly milestonesService: MilestonesService) {}

  onModuleInit(): void {
    const interval = resolveMilestoneScanIntervalMs();
    this.initialTimer = setTimeout(() => {
      void this.runScan();
      this.intervalTimer = setInterval(() => void this.runScan(), interval);
      this.intervalTimer.unref?.();
    }, MILESTONE_SCAN_INITIAL_DELAY_MS);
    this.initialTimer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.initialTimer) {
      clearTimeout(this.initialTimer);
    }
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
    }
  }

  async runScan(): Promise<void> {
    try {
      const summary = await this.milestonesService.runDailyScan();
      this.logger.log(
        `Barrido de hitos: ${summary.delayed} retrasados, ` +
          `${summary.notices} avisos enviados.`,
      );
    } catch (error) {
      this.logger.error('Fallo el barrido diario de hitos.', error as Error);
    }
  }
}
