import { GraphQLError } from 'graphql';
import type { PageInfoGql } from './pagination.model.js';

/**
 * F2-03 / RF-013: normalizacion de paginacion, filtros y ordenamiento.
 * Sin E/S: testeable y reusable por cualquier listado.
 */

export const PAGINATION_DEFAULT_PAGE_SIZE = 20;
export const PAGINATION_MAX_PAGE_SIZE = 50;

export interface PageArgs {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: string;
}

export interface NormalizedPage {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
  /** Campo de ordenamiento ya validado (null = orden por defecto). */
  sortBy: string | null;
  sortDir: 'asc' | 'desc';
}

export interface PageInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PageResult<T> {
  items: T[];
  pageInfo: PageInfo;
}

function validationError(message: string, field: string): never {
  throw new GraphQLError(message, {
    extensions: { code: 'VALIDATION_ERROR', field },
  });
}

/**
 * Valida pagina, tamano y orden. `sortBy` debe pertenecer a la lista
 * blanca del listado; un valor desconocido se rechaza con
 * `VALIDATION_ERROR` en lugar de silenciarse.
 */
export function normalizePageArgs(
  args: PageArgs | null | undefined,
  allowedSortFields: readonly string[] = [],
  defaultSort?: { sortBy?: string; sortDir?: 'asc' | 'desc' },
): NormalizedPage {
  const page = args?.page ?? 1;
  const pageSize = args?.pageSize ?? PAGINATION_DEFAULT_PAGE_SIZE;

  if (!Number.isInteger(page) || page < 1) {
    validationError('La pagina debe ser un entero mayor o igual a 1.', 'page');
  }
  if (!Number.isInteger(pageSize) || pageSize < 1) {
    validationError(
      'El tamano de pagina debe ser un entero mayor o igual a 1.',
      'pageSize',
    );
  }

  const sortDirRaw = args?.sortDir ?? defaultSort?.sortDir ?? 'desc';
  if (sortDirRaw !== 'asc' && sortDirRaw !== 'desc') {
    validationError('La direccion de orden debe ser asc o desc.', 'sortDir');
  }

  let sortBy: string | null = null;
  if (args?.sortBy) {
    if (!allowedSortFields.includes(args.sortBy)) {
      validationError(
        `Ordenamiento no soportado. Valores: ${allowedSortFields.join(', ')}.`,
        'sortBy',
      );
    }
    sortBy = args.sortBy;
  } else {
    sortBy = defaultSort?.sortBy ?? null;
  }

  const size = Math.min(pageSize, PAGINATION_MAX_PAGE_SIZE);
  return {
    page,
    pageSize: size,
    skip: (page - 1) * size,
    take: size,
    sortBy,
    sortDir: sortDirRaw,
  };
}

/** Traduce el campo validado al nombre de columna de Prisma. */
export function orderByFrom(
  normalized: NormalizedPage,
  fieldMap: Record<string, string>,
): Record<string, 'asc' | 'desc'> | undefined {
  if (!normalized.sortBy) {
    return undefined;
  }
  const column = fieldMap[normalized.sortBy];
  if (!column) {
    return undefined;
  }
  return { [column]: normalized.sortDir };
}

export function buildPageInfo(
  normalized: Pick<NormalizedPage, 'page' | 'pageSize'>,
  total: number,
): PageInfo {
  const totalPages = Math.max(1, Math.ceil(total / normalized.pageSize));
  return {
    page: normalized.page,
    pageSize: normalized.pageSize,
    total,
    totalPages,
    hasNextPage: normalized.page < totalPages,
    hasPreviousPage: normalized.page > 1,
  };
}

export function toPageInfoGql(
  info: PageInfo,
  target: PageInfoGql,
): PageInfoGql {
  target.page = info.page;
  target.pageSize = info.pageSize;
  target.total = info.total;
  target.totalPages = info.totalPages;
  target.hasNextPage = info.hasNextPage;
  target.hasPreviousPage = info.hasPreviousPage;
  return target;
}
