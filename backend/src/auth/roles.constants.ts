// backend/src/auth/roles.constants.ts

/**
 * Valores de los roles de plataforma. Deben coincidir EXACTAMENTE con el
 * enum `Role` de Prisma (backend/prisma/schema.prisma).
 *
 * Centralizados aqui para evitar typos en guards, decoradores y servicios.
 *
 * NOTA: cuando se aplique el rename acordado (STUDENT -> RESEARCHER,
 * PRINCIPAL_INVESTIGATOR -> PROJECT_LEADER), este archivo es el unico
 * punto a actualizar ademas de la migracion Prisma.
 */
export const ROLES = {
  STUDENT: 'STUDENT',
  PRINCIPAL_INVESTIGATOR: 'PRINCIPAL_INVESTIGATOR',
  COORDINATOR: 'COORDINATOR',
  COMMITTEE: 'COMMITTEE',
  ADMINISTRATOR: 'ADMINISTRATOR',
} as const;

export type AppRole = (typeof ROLES)[keyof typeof ROLES];

/** Codigos de error GraphQL especificos de autorizacion (RF-001). */
export const AUTH_ERROR_CODES = {
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
} as const;