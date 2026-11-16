import { describe, expect, it } from 'vitest';
import {
  canChangeAdministratorRole,
  normalizeUserQuery,
} from './admin.policy.js';

describe('normalizeUserQuery (F1-07)', () => {
  it('aplica defaults y acota el tamano de pagina', () => {
    const result = normalizeUserQuery({}, 1, 500);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(50);
    expect(result.where).toEqual({});
  });

  it('normaliza rol, busqueda y estado de verificacion', () => {
    const result = normalizeUserQuery(
      {
        role: 'ADMINISTRATOR',
        search: '  ana  ',
        emailVerified: false,
        lockedOnly: true,
      },
      2,
      10,
      new Date('2026-11-13T00:00:00.000Z'),
    );
    expect(result.where.role).toBe('ADMINISTRATOR');
    expect(result.where.emailVerified).toBe(false);
    expect(result.where.lockedUntil).toEqual({
      gt: new Date('2026-11-13T00:00:00.000Z'),
    });
    expect(result.where.OR).toEqual([
      { name: { contains: 'ana', mode: 'insensitive' } },
      { email: { contains: 'ana', mode: 'insensitive' } },
    ]);
  });

  it('rechaza roles desconocidos y paginas invalidas', () => {
    expect(() =>
      normalizeUserQuery({ role: 'SUPER_ADMIN' }, 1, 20),
    ).toThrow(/rol indicado no es valido/i);
    expect(() => normalizeUserQuery({}, 0, 20)).toThrow(/pagina/i);
  });
});

describe('canChangeAdministratorRole (F1-07)', () => {
  it('permite cambiar roles que no afectan al ultimo administrador', () => {
    expect(canChangeAdministratorRole('STUDENT', 'COORDINATOR', 0)).toBe(true);
    expect(canChangeAdministratorRole('ADMINISTRATOR', 'ADMINISTRATOR', 1)).toBe(
      true,
    );
  });

  it('bloquea quitar el rol al ultimo administrador', () => {
    expect(canChangeAdministratorRole('ADMINISTRATOR', 'STUDENT', 1)).toBe(
      false,
    );
    expect(canChangeAdministratorRole('ADMINISTRATOR', 'STUDENT', 2)).toBe(true);
  });
});
