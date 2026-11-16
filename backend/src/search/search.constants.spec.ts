import { describe, expect, it } from 'vitest';
import {
  canSearchUsers,
  canSeeAllConfidentialProjects,
  isSearchType,
  normalizeSearchQuery,
} from './search.constants.js';

describe('normalizeSearchQuery', () => {
  it('recorta y colapsa espacios', () => {
    expect(normalizeSearchQuery('  cambio   climatico  ')).toEqual({
      ok: true,
      query: 'cambio climatico',
    });
  });

  it('rechaza consultas demasiado cortas', () => {
    expect(normalizeSearchQuery(' a ')).toEqual({
      ok: false,
      message: 'La busqueda debe tener al menos 2 caracteres.',
    });
  });

  it('rechaza consultas vacias', () => {
    expect(normalizeSearchQuery(null).ok).toBe(false);
  });

  it('rechaza consultas fuera de longitud', () => {
    expect(normalizeSearchQuery('x'.repeat(201)).ok).toBe(false);
  });
});

describe('search role rules', () => {
  it('solo administracion busca usuarios', () => {
    expect(canSearchUsers('ADMINISTRATOR')).toBe(true);
    expect(canSearchUsers('COORDINATOR')).toBe(false);
    expect(canSearchUsers('STUDENT')).toBe(false);
  });

  it('solo administracion ve proyectos confidenciales ajenos', () => {
    expect(canSeeAllConfidentialProjects('ADMINISTRATOR')).toBe(true);
    expect(canSeeAllConfidentialProjects('COORDINATOR')).toBe(false);
  });

  it('valida los tipos soportados', () => {
    expect(isSearchType('PROJECT')).toBe(true);
    expect(isSearchType('CALL')).toBe(true);
    expect(isSearchType('USER')).toBe(true);
    expect(isSearchType('OTHER')).toBe(false);
  });
});
