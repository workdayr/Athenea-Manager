import { GraphQLError } from 'graphql';
import {
  AUDIT_ACTION_MAX_LENGTH,
  AUDIT_ERROR_CODES,
  AUDIT_PAGE_SIZE_DEFAULT,
  AUDIT_PAGE_SIZE_MAX,
} from './audit.constants.js';

export interface AuditFilters {
  actorId?: string | null;
  action?: string | null;
  targetId?: string | null;
  from?: Date | null;
  to?: Date | null;
}

export interface AuditWhere {
  actor_id?: string;
  action?: { contains: string; mode: 'insensitive' };
  target_id?: string;
  timestamp?: { gte?: Date; lte?: Date };
}

export interface NormalizedAuditQuery {
  where: AuditWhere;
  page: number;
  pageSize: number;
}

function validationError(message: string, field: string): never {
  throw new GraphQLError(message, {
    extensions: { code: AUDIT_ERROR_CODES.VALIDATION_ERROR, field },
  });
}

function clean(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function validDate(value: Date | null | undefined, field: string): Date | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    validationError('La fecha del filtro no es valida.', field);
  }
  return value;
}

/** Valida y normaliza filtros/paginacion; el servicio no confia en GraphQL. */
export function normalizeAuditQuery(
  filters: AuditFilters = {},
  page: number = 1,
  pageSize: number = AUDIT_PAGE_SIZE_DEFAULT,
): NormalizedAuditQuery {
  if (!Number.isInteger(page) || page < 1) {
    validationError('La pagina debe ser un entero mayor o igual a 1.', 'page');
  }
  if (!Number.isInteger(pageSize) || pageSize < 1) {
    validationError(
      'El tamano de pagina debe ser un entero mayor o igual a 1.',
      'pageSize',
    );
  }

  const actorId = clean(filters.actorId);
  const action = clean(filters.action);
  const targetId = clean(filters.targetId);
  if (action && action.length > AUDIT_ACTION_MAX_LENGTH) {
    validationError(
      `La accion no puede exceder ${AUDIT_ACTION_MAX_LENGTH} caracteres.`,
      'action',
    );
  }
  const from = validDate(filters.from, 'from');
  const to = validDate(filters.to, 'to');
  if (from && to && from.getTime() > to.getTime()) {
    validationError(
      'El rango de fechas es invalido: "from" es posterior a "to".',
      'from',
    );
  }

  const where: AuditWhere = {};
  if (actorId) {
    where.actor_id = actorId;
  }
  if (action) {
    where.action = { contains: action, mode: 'insensitive' };
  }
  if (targetId) {
    where.target_id = targetId;
  }
  if (from || to) {
    where.timestamp = {};
    if (from) {
      where.timestamp.gte = from;
    }
    if (to) {
      where.timestamp.lte = to;
    }
  }

  return {
    where,
    page,
    pageSize: Math.min(pageSize, AUDIT_PAGE_SIZE_MAX),
  };
}
