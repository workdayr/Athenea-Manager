import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { HealthService, type HealthCheckResult } from './health.service.js';

/**
 * F1-08: endpoints de salud. Responden 503 cuando la dependencia critica
 * (PostgreSQL) no esta disponible, para que el orquestador retire la
 * instancia del balanceo.
 */
@Controller()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('health')
  async health(@Res({ passthrough: true }) res: Response) {
    return this.respond(res);
  }

  @Get('health/ready')
  async ready(@Res({ passthrough: true }) res: Response) {
    return this.respond(res);
  }

  private async respond(res: Response): Promise<HealthCheckResult> {
    const result = await this.healthService.check();
    if (result.status !== 'ok') {
      res.status(503);
    }
    return result;
  }
}
