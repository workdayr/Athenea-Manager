import {
  Injectable,
  Logger,
  Module,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { CallsResolver } from './calls.resolver.js';
import { CALL_AUTO_CLOSE_INTERVAL_MS } from './calls.constants.js';
import { closeExpiredCalls } from './calls.service.js';

/**
 * Cierre automatico por deadline (RF-018): cada minuto marca CLOSED las
 * convocatorias OPEN vencidas. El cierre por cupo ocurre en la
 * transaccion de postulacion (`submitProposalToCall`, row-level locking).
 */
@Injectable()
class CallsAutoCloseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CallsAutoCloseService.name);
  private timer?: NodeJS.Timeout;

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void closeExpiredCalls()
        .then((count) => {
          if (count > 0) {
            this.logger.log(`Cierre automatico: ${count} convocatoria(s).`);
          }
        })
        .catch((error: unknown) => {
          this.logger.error('Fallo el cierre automatico.', error as Error);
        });
    }, CALL_AUTO_CLOSE_INTERVAL_MS);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }
}

@Module({
  providers: [CallsResolver, CallsAutoCloseService],
})
export class CallsModule {}
