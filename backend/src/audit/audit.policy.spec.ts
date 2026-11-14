import { describe, expect, it } from 'vitest';
import { normalizeAuditQuery } from './audit.policy.js';

describe('normalizeAuditQuery (F1-08 / RF-017)', () => {
  it('aplica paginacion por defecto', () => {
    expect(normalizeAuditQuery()).toEqual({
      where: {},
      page: 1,
      pageSize: 20,
    });
  });

  it('normaliza filtros y construye el where', () => {
    const from = new Date('2026-01-01T00:00:00.000Z');
    const to = new Date('2026-12-31T23:59:59.000Z');

    const query = normalizeAuditQuery(
      {
        actorId: ' user-1 ',
        action: ' submit_project_decision ',
        targetId: ' 5 ',
        from,
        to,
      },
      2,
      10,
    );

    expect(query).toEqual({
      where: {
        actor_id: 'user-1',
        action: { contains: 'submit_project_decision', mode: 'insensitive' },
        target_id: '5',
        timestamp: { gte: from, lte: to },
      },
      page: 2,
      pageSize: 10,
    });
  });

  it('acota el tamano de pagina al maximo', () => {
    expect(normalizeAuditQuery({}, 1, 500).pageSize).toBe(50);
  });

  it('rechaza paginas invalidas', () => {
    expect(() => normalizeAuditQuery({}, 0, 20)).toThrowError(
      /pagina debe ser un entero/,
    );
    expect(() => normalizeAuditQuery({}, 1, 0)).toThrowError(
      /tamano de pagina debe ser un entero/,
    );
  });

  it('rechaza rangos de fecha invertidos', () => {
    expect(() =>
      normalizeAuditQuery({
        from: new Date('2026-12-31T00:00:00.000Z'),
        to: new Date('2026-01-01T00:00:00.000Z'),
      }),
    ).toThrowError(/rango de fechas es invalido/);
  });

  it('rechaza acciones demasiado largas', () => {
    expect(() =>
      normalizeAuditQuery({ action: 'x'.repeat(256) }),
    ).toThrowError(/no puede exceder/);
  });
});
