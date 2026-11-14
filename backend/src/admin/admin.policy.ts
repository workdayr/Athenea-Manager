import { GraphQLError } from 'graphql';
import {
  ADMIN_ERROR_CODES,
  isAssignableRole,
  USERS_PAGE_SIZE_DEFAULT,
  USERS_PAGE_SIZE_MAX,
  USER_SEARCH_MAX_LENGTH,
  type AssignableRole,
} from './admin.constants.js';

/** Filtros de la tabla de usuarios (F1-07). */
export interface UserFilters {
  role?: string | null;
  search?: string | null;
  emailVerified?: boolean | null;
  lockedOnly?: boolean | null;
}

export interface UserWhere {
  role?: AssignableRole;
  emailVerified?: boolean;
  lockedUntil?: { gt: Date };
  OR?: Array<
    | { name: { contains: string; mode: 'insensitive' } }
    | { email: { contains: string; mode: 'insensitive' } }
  >;
}

export interface NormalizedUserQuery {
  where: UserWhere;
  page: number;
  pageSize: number;
}

function validationError(message: string, field: string): never {
  throw new GraphQLError(message, {
    extensions: { code: ADMIN_ERROR_CODES.VALIDATION_ERROR, field },
  });
}

function clean(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Valida y normaliza filtros/paginacion. El servicio no confia en los
 * argumentos GraphQL (defensa en profundidad).
 */
export function normalizeUserQuery(
  filters: UserFilters = {},
  page: number = 1,
  pageSize: number = USERS_PAGE_SIZE_DEFAULT,
  now: Date = new Date(),
): NormalizedUserQuery {
  if (!Number.isInteger(page) || page < 1) {
    validationError('La pagina debe ser un entero mayor o igual a 1.', 'page');
  }
  if (!Number.isInteger(pageSize) || pageSize < 1) {
    validationError(
      'El tamano de pagina debe ser un entero mayor o igual a 1.',
      'pageSize',
    );
  }

  const where: UserWhere = {};

  const role = clean(filters.role);
  if (role) {
    if (!isAssignableRole(role)) {
      validationError('El rol indicado no es valido.', 'role');
    }
    where.role = role;
  }

  const search = clean(filters.search);
  if (search) {
    if (search.length > USER_SEARCH_MAX_LENGTH) {
      validationError(
        `La busqueda no puede exceder ${USER_SEARCH_MAX_LENGTH} caracteres.`,
        'search',
      );
    }
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (typeof filters.emailVerified === 'boolean') {
    where.emailVerified = filters.emailVerified;
  }

  if (filters.lockedOnly === true) {
    where.lockedUntil = { gt: now };
  }

  return {
    where,
    page,
    pageSize: Math.min(pageSize, USERS_PAGE_SIZE_MAX),
  };
}

/**
 * Regla del ultimo administrador: un administrador no puede quitarse (ni
 * quitar a otro) el unico rol ADMINISTRATOR del sistema.
 */
export function canChangeAdministratorRole(
  currentRole: string,
  nextRole: string,
  administratorCount: number,
): boolean {
  if (currentRole !== 'ADMINISTRATOR' || nextRole === 'ADMINISTRATOR') {
    return true;
  }
  return administratorCount > 1;
}
