import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CALL_ERROR_CODES } from './calls.constants.js';

const FUTURE = new Date('2026-12-31T23:59:59Z');

const { sqlLog, state, tx } = vi.hoisted(() => {
  const sqlLog: string[] = [];
  const state = {
    status: 'OPEN',
    deadline: new Date('2026-12-31T23:59:59Z'),
    cap: 2,
    count: 0,
    existingApplications: 0,
  };
  const tx = {
    $queryRaw: async (strings: TemplateStringsArray) => {
      sqlLog.push(strings.join('?'));
      return [
        {
          call_id: 7,
          status: state.status,
          deadline: state.deadline,
          application_cap: state.cap,
          application_count: state.count,
        },
      ];
    },
    announcement: {
      update: async (args: {
        data: { status?: string; application_count?: { increment: number } };
      }) => {
        if (args.data.status) state.status = args.data.status;
        if (args.data.application_count)
          state.count += args.data.application_count.increment;
        return {
          call_id: 7,
          status: state.status,
          deadline: state.deadline,
          application_cap: state.cap,
          application_count: state.count,
        };
      },
    },
    project: {
      count: async () => state.existingApplications,
      create: async () => ({ project_id: 99 }),
    },
  };
  return { sqlLog, state, tx };
});

vi.mock('../db/prisma.js', () => ({
  prisma: { $transaction: (fn: (t: unknown) => unknown) => fn(tx) },
}));

import { submitProposalToCall } from './calls.service.js';

const user = {
  id: 'pi-1',
  email: 'pi@unipolidgo.edu.mx',
  name: 'PI',
  role: 'PRINCIPAL_INVESTIGATOR',
};

const data = {
  title: 'Proyecto concurrente',
  objectives: 'Objetivos.',
  startDate: new Date('2026-01-01'),
  endDate: new Date('2026-12-31'),
  callId: 7,
};

describe('submitProposalToCall cableado real (RF-018)', () => {
  beforeEach(() => {
    sqlLog.length = 0;
    state.status = 'OPEN';
    state.deadline = FUTURE;
    state.count = 0;
    state.existingApplications = 0;
  });

  it('emite SELECT ... FOR UPDATE dentro de la transaccion', async () => {
    await submitProposalToCall(user, data);
    expect(sqlLog).toHaveLength(1);
    expect(sqlLog[0]).toContain('FOR UPDATE');
    expect(state.count).toBe(1);
    expect(state.status).toBe('OPEN'); // aun hay cupo (1/2)
  });

  it('la postulacion que llena el cupo cierra la convocatoria', async () => {
    state.count = 1; // 1/2 ocupados
    const { closedByCap } = (await submitProposalToCall(user, data)) as {
      closedByCap: boolean;
    };
    expect(closedByCap).toBe(true);
    expect(state.count).toBe(2);
    expect(state.status).toBe('CLOSED');
  });

  it('con cupo lleno rechaza con CALL_FULL y cierra la convocatoria', async () => {
    state.count = 2; // OPEN pero 2/2: llena
    await expect(submitProposalToCall(user, data)).rejects.toMatchObject({
      code: CALL_ERROR_CODES.CALL_FULL,
    });
    expect(state.count).toBe(2);
    expect(state.status).toBe('CLOSED');
  });

  it('bloquea una segunda postulacion del mismo PI a la convocatoria', async () => {
    state.existingApplications = 1;
    await expect(submitProposalToCall(user, data)).rejects.toMatchObject({
      code: CALL_ERROR_CODES.ALREADY_APPLIED,
      httpStatus: 409,
    });
    // No consume cupo ni cierra la convocatoria.
    expect(state.count).toBe(0);
    expect(state.status).toBe('OPEN');
  });
});
