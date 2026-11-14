/**
 * F2-01 / RF-012: busqueda interna con PostgreSQL FTS.
 * Sin E/S para que la validacion de entrada sea testeable.
 */

export const SEARCH_ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  FORBIDDEN: 'FORBIDDEN',
} as const;

export const SEARCH_MIN_QUERY_LENGTH = 2;
export const SEARCH_MAX_QUERY_LENGTH = 200;

export const SEARCH_TYPES = ['PROJECT', 'CALL', 'USER'] as const;
export type SearchTypeValue = (typeof SEARCH_TYPES)[number];

export function isSearchType(value: string): value is SearchTypeValue {
  return (SEARCH_TYPES as readonly string[]).includes(value);
}

/** Normaliza la consulta: recorta espacios y valida longitud. */
export function normalizeSearchQuery(value: string | null | undefined):
  | { ok: true; query: string }
  | { ok: false; message: string } {
  const query = (value ?? '').trim().replace(/\s+/g, ' ');
  if (query.length < SEARCH_MIN_QUERY_LENGTH) {
    return {
      ok: false,
      message: `La busqueda debe tener al menos ${SEARCH_MIN_QUERY_LENGTH} caracteres.`,
    };
  }
  if (query.length > SEARCH_MAX_QUERY_LENGTH) {
    return {
      ok: false,
      message: `La busqueda no puede exceder ${SEARCH_MAX_QUERY_LENGTH} caracteres.`,
    };
  }
  return { ok: true, query };
}

/**
 * BR-007: los proyectos confidenciales solo aparecen para su equipo y para
 * administracion. Coordinacion y comite quedan fuera aunque sean
 * institucionales.
 */
export function canSearchUsers(role: string): boolean {
  return role === 'ADMINISTRATOR';
}

export function canSeeAllConfidentialProjects(role: string): boolean {
  return role === 'ADMINISTRATOR';
}
