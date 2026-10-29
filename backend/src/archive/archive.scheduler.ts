import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  ARCHIVE_SCAN_INITIAL_DELAY_MS,
  resolveArchiveIntervalMs,
} from './archive.constants.js';
import { ProjectArchiveService } from './archive.service.js';

/**
 * RF-020: job diario que archiva los proyectos en estado `Closed`.
 *
 * Se ejecuta una vez poco despues del arranque (para no esperar 24 h en
 * despliegues con proyectos ya cerrados) y luego con el intervalo
 * configurado. El servicio usa una transaccion Serializable por proyecto,
 * por lo que puede correr en varias instancias sin archivar dos veces.
 */
@Injectable()
export class ProjectArchiveScheduler
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(ProjectArchiveScheduler.name);
  private initialTimer?: NodeJS.Timeout;
  private timer?: NodeJS.Timeout;

  constructor(private readonly archiveService: ProjectArchiveService) {}

  onModuleInit(): void {
    const intervalMs = resolveArchiveIntervalMs();

    this.initialTimer = setTimeout(() => {
      void this.run('arranque');
    }, ARCHIVE_SCAN_INITIAL_DELAY_MS);
    this.initialTimer.unref?.();

    this.timer = setInterval(() => {
      void this.run('programado');
    }, intervalMs);
    this.timer.unref?.();

    this.logger.log(
      `Archivado automatico (RF-020) activo; intervalo: ${intervalMs} ms.`,
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
      const summary = await this.archiveService.archiveClosedProjects();
      if (summary.scanned > 0 || summary.failed > 0) {
        this.logger.log(
          `Archivado (${trigger}): ${summary.archived} archivados, ` +
            `${summary.skipped} omitidos, ${summary.failed} fallidos ` +
            `de ${summary.scanned} revisados.`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Fallo el job de archivado (${trigger}).`,
        error as Error,
      );
    }
  }
}
