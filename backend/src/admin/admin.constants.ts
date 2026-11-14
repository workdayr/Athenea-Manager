/**
 * F1-07 / RF-001: administracion de usuarios y roles de plataforma.
 */

/** Paginacion de la tabla de usuarios. */
export const USERS_PAGE_SIZE_DEFAULT = 20;
export const USERS_PAGE_SIZE_MAX = 50;

/** Longitud maxima del texto de busqueda (nombre o correo). */
export const USER_SEARCH_MAX_LENGTH = 150;

/** Roles validos; deben coincidir con el enum `Role` de Prisma. */
export const ASSIGNABLE_ROLES = [
  'STUDENT',
  'PRINCIPAL_INVESTIGATOR',
  'COORDINATOR',
  'COMMITTEE',
  'ADMINISTRATOR',
] as const;

export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

/** Codigos de error del modulo (se mapean a GraphQL). */
export const ADMIN_ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  FORBIDDEN: 'FORBIDDEN',
  LAST_ADMINISTRATOR: 'LAST_ADMINISTRATOR',
} as const;

/** Accion registrada en `Audit_Log` al reasignar un rol (RF-017). */
export const ROLE_CHANGE_AUDIT_ACTION = 'ROLE_CHANGE';

export function isAssignableRole(value: unknown): value is AssignableRole {
  return (
    typeof value === 'string' &&
    (ASSIGNABLE_ROLES as readonly string[]).includes(value)
  );
}
