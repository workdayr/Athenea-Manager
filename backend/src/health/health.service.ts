import { Injectable, Logger } from '@nestjs/common';
import { prisma } from '../db/prisma.js';

export interface HealthCheckResult {
  status: 'ok' | 'error';
  timestamp: string;
  uptimeSeconds: number;
  checks: {
    database: 'up' | 'down';
  };
}

/**
 * RNF-002 / F1-08: sonda de salud para orquestadores y balanceadores.
 * `GET /health` y `GET /health/ready` comprueban el proceso y la BD.
 */
@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  async check(): Promise<HealthCheckResult> {
    let database: 'up' | 'down' = 'up';
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      database = 'down';
      this.logger.error('La sonda de salud no pudo consultar la BD.', error as Error);
    }

    return {
      status: database === 'up' ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      checks: { database },
    };
  }
}
