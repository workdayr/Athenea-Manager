import { describe, expect, it } from 'vitest';
import {
  buildPageInfo,
  normalizePageArgs,
  orderByFrom,
} from './pagination.policy.js';

describe('normalizePageArgs (F2-03)', () => {
  it('aplica defaults y acota pageSize a 50', () => {
    const result = normalizePageArgs({}, ['createdAt']);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
    expect(result.skip).toBe(0);
    expect(result.take).toBe(20);

    const big = normalizePageArgs({ page: 3, pageSize: 500 }, ['createdAt']);
    expect(big.pageSize).toBe(50);
    expect(big.skip).toBe(100);
    expect(big.take).toBe(50);
  });

  it('valida y normaliza el ordenamiento', () => {
    const asc = normalizePageArgs(
      { sortBy: 'createdAt', sortDir: 'asc' },
      ['createdAt', 'name'],
    );
    expect(asc.sortBy).toBe('createdAt');
    expect(asc.sortDir).toBe('asc');

    expect(() =>
      normalizePageArgs({ sortBy: 'password' }, ['createdAt']),
    ).toThrow(/Ordenamiento no soportado/);
    expect(() =>
      normalizePageArgs({ sortDir: 'random' }, ['createdAt']),
    ).toThrow(/direccion de orden/i);
  });

  it('rechaza paginas invalidas y mapea columnas', () => {
    expect(() => normalizePageArgs({ page: 0 })).toThrow(/pagina/i);
    expect(() => normalizePageArgs({ pageSize: 0 })).toThrow(/pagina/i);

    const normalized = normalizePageArgs(
      { sortBy: 'createdAt', sortDir: 'asc' },
      ['createdAt'],
    );
    expect(orderByFrom(normalized, { createdAt: 'created_at' })).toEqual({
      created_at: 'asc',
    });
    expect(orderByFrom(normalized, {})).toBeUndefined();
  });
});

describe('buildPageInfo (F2-03)', () => {
  it('calcula totales y banderas', () => {
    expect(buildPageInfo({ page: 2, pageSize: 10 }, 25)).toEqual({
      page: 2,
      pageSize: 10,
      total: 25,
      totalPages: 3,
      hasNextPage: true,
      hasPreviousPage: true,
    });
    expect(buildPageInfo({ page: 3, pageSize: 10 }, 25)).toEqual({
      page: 3,
      pageSize: 10,
      total: 25,
      totalPages: 3,
      hasNextPage: false,
      hasPreviousPage: true,
    });
  });
});
