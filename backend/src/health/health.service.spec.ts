import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { $queryRaw: vi.fn() },
}));

vi.mock('../db/prisma.js', () => ({ prisma: prismaMock }));

import type { Response } from 'express';
import { HealthController } from './health.controller.js';
import { HealthService, type HealthCheckResult } from './health.service.js';

beforeEach(() => {
  vi.resetAllMocks();
});

describe('HealthService (F1-08)', () => {
  it('responde ok cuando la BD responde', async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    const result = await new HealthService().check();

    expect(result.status).toBe('ok');
    expect(result.checks.database).toBe('up');
    expect(typeof result.timestamp).toBe('string');
  });

  it('responde error cuando la BD no responde', async () => {
    prismaMock.$queryRaw.mockRejectedValue(new Error('ECONNREFUSED'));

    const result = await new HealthService().check();

    expect(result.status).toBe('error');
    expect(result.checks.database).toBe('down');
  });
});

describe('HealthController (F1-08)', () => {
  function response() {
    return { status: vi.fn() } as unknown as Response & {
      status: ReturnType<typeof vi.fn>;
    };
  }

  it('mantiene 200 cuando la sonda es ok', async () => {
    const result: HealthCheckResult = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptimeSeconds: 10,
      checks: { database: 'up' },
    };
    const controller = new HealthController({
      check: vi.fn().mockResolvedValue(result),
    } as unknown as HealthService);
    const res = response();

    await expect(controller.health(res)).resolves.toEqual(result);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('responde 503 cuando la sonda falla', async () => {
    const result: HealthCheckResult = {
      status: 'error',
      timestamp: new Date().toISOString(),
      uptimeSeconds: 10,
      checks: { database: 'down' },
    };
    const controller = new HealthController({
      check: vi.fn().mockResolvedValue(result),
    } as unknown as HealthService);
    const res = response();

    await expect(controller.ready(res)).resolves.toEqual(result);
    expect(res.status).toHaveBeenCalledWith(503);
  });
});
