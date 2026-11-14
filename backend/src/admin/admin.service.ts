import { GraphQLError } from 'graphql';
import { prisma } from '../db/prisma.js';
import type { Role } from '../generated/prisma/enums.js';
import { notifyUser } from '../notifications/notifications.service.js';
import type { AuthenticatedUser } from '../projects/session.guard.js';
import {
  ADMIN_ERROR_CODES,
  isAssignableRole,
  ROLE_CHANGE_AUDIT_ACTION,
  type AssignableRole,
} from './admin.constants.js';
import {
  canChangeAdministratorRole,
  normalizeUserQuery,
  type UserFilters,
} from './admin.policy.js';
import {
  buildPageInfo,
  normalizePageArgs,
  orderByFrom,
  type PageArgs,
  type PageInfo,
} from '../common/pagination/pagination.policy.js';

/** Campos de ordenamiento expuestos por la tabla de usuarios (F2-03). */
const USER_SORT_FIELDS = ['createdAt', 'name', 'email', 'role'] as const;
const USER_SORT_COLUMNS: Record<string, string> = {
  createdAt: 'createdAt',
  name: 'name',
  email: 'email',
  role: 'role',
};

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  role: AssignableRole;
  createdAt: Date;
  lockedUntil: Date | null;
}

export interface AdminUserPage {
  items: AdminUserRow[];
  total: number;
  page: number;
  pageSize: number;
  pageInfo: PageInfo;
}

const ROLE_LABELS: Record<AssignableRole, string> = {
  STUDENT: 'Miembro del Equipo',
  PRINCIPAL_INVESTIGATOR: 'Investigador Principal',
  COORDINATOR: 'Coordinador / Evaluador',
  COMMITTEE: 'Comité de Evaluación',
  ADMINISTRATOR: 'Administrador',
};

function validationError(message: string, field: string): never {
  throw new GraphQLError(message, {
    extensions: { code: ADMIN_ERROR_CODES.VALIDATION_ERROR, field },
  });
}

function notFoundError(): never {
  throw new GraphQLError('El usuario indicado no existe.', {
    extensions: { code: ADMIN_ERROR_CODES.NOT_FOUND, field: 'userId' },
  });
}

function toRow(row: {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  role: string;
  createdAt: Date;
  lockedUntil: Date | null;
}): AdminUserRow {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    emailVerified: row.emailVerified,
    role: row.role as AssignableRole,
    createdAt: row.createdAt,
    lockedUntil: row.lockedUntil,
  };
}

/** RF-001 / F1-07: listado paginado de usuarios para administracion. */
export async function listUsers(
  filters: UserFilters = {},
  page = 1,
  pageSize = 20,
  paging: PageArgs = {},
): Promise<AdminUserPage> {
  const ordering = normalizePageArgs(
    { ...paging, page, pageSize },
    USER_SORT_FIELDS,
    { sortBy: 'createdAt', sortDir: 'desc' },
  );
  const normalized = normalizeUserQuery(
    filters,
    ordering.page,
    ordering.pageSize,
  );
  const orderBy = orderByFrom(ordering, USER_SORT_COLUMNS) ?? {
    createdAt: 'desc' as const,
  };
  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where: normalized.where as never,
      orderBy: orderBy as never,
      skip: ordering.skip,
      take: ordering.take,
      select: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
        role: true,
        createdAt: true,
        lockedUntil: true,
      },
    }),
    prisma.user.count({ where: normalized.where as never }),
  ]);

  return {
    items: rows.map(toRow),
    total,
    page: normalized.page,
    pageSize: normalized.pageSize,
    pageInfo: buildPageInfo(ordering, total),
  };
}

/**
 * F1-07 / RF-001: reasigna el rol de plataforma de un usuario.
 *
 * - Solo roles del enum (el rol nunca se acepta desde el cliente en el alta).
 * - Protege al ultimo administrador (BR-005: la whitelist administrativa
 *   no puede quedar vacia).
 * - Registra `ROLE_CHANGE` en la bitacora y notifica al usuario afectado.
 */
export async function updateUserRole(
  actor: AuthenticatedUser,
  userId: string,
  nextRole: string,
  sourceIp: string,
): Promise<AdminUserRow> {
  // Defensa en profundidad: RolesGuard ya exige ADMINISTRATOR en GraphQL,
  // pero una invocacion directa del servicio tampoco puede cambiar roles.
  if (actor.role !== 'ADMINISTRATOR') {
    throw new GraphQLError(
      'Solo un Administrador puede cambiar roles de plataforma.',
      { extensions: { code: ADMIN_ERROR_CODES.FORBIDDEN, field: null } },
    );
  }
  if (typeof userId !== 'string' || userId.trim().length === 0) {
    validationError('El usuario es obligatorio.', 'userId');
  }
  if (!isAssignableRole(nextRole)) {
    validationError('El rol indicado no es valido.', 'role');
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      role: true,
      createdAt: true,
      lockedUntil: true,
    },
  });
  if (!target) {
    notFoundError();
  }

  if (target.role === nextRole) {
    return toRow(target);
  }

  if (target.role === 'ADMINISTRATOR' && nextRole !== 'ADMINISTRATOR') {
    const administratorCount = await prisma.user.count({
      where: { role: 'ADMINISTRATOR' },
    });
    if (
      !canChangeAdministratorRole(target.role, nextRole, administratorCount)
    ) {
      throw new GraphQLError(
        'No puedes quitar el rol al ultimo administrador del sistema.',
        {
          extensions: {
            code: ADMIN_ERROR_CODES.LAST_ADMINISTRATOR,
            field: 'role',
          },
        },
      );
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: userId },
      data: { role: nextRole as Role },
      select: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
        role: true,
        createdAt: true,
        lockedUntil: true,
      },
    });

    await tx.audit_Log.create({
      data: {
        actor_id: actor.id,
        action: ROLE_CHANGE_AUDIT_ACTION,
        target_id: user.id,
        source_ip: sourceIp,
      },
    });

    await notifyUser(tx, user.id, {
      type: 'Role',
      title: 'Tu rol en Athenea Manager cambió',
      message: `La administración actualizó tu rol de ${ROLE_LABELS[target.role as AssignableRole] ?? target.role} a ${ROLE_LABELS[nextRole]}. Los módulos disponibles se ajustaron a tu nuevo rol.`,
      link: '/dashboard',
    });

    return user;
  });

  return toRow(updated);
}
