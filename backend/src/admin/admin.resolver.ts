import { UseGuards } from '@nestjs/common';
import {
  Args,
  Context,
  ID,
  Int,
  Mutation,
  Query,
  Resolver,
} from '@nestjs/graphql';
import { ROLES } from '../auth/roles.constants.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { CurrentUser } from '../projects/current-user.decorator.js';
import {
  SessionGuard,
  type AuthenticatedUser,
} from '../projects/session.guard.js';
import {
  PageInfoGql,
  SortDirectionGql,
} from '../common/pagination/pagination.model.js';
import { toPageInfoGql } from '../common/pagination/pagination.policy.js';
import {
  AdminUserGql,
  AdminUserPageGql,
  RoleGql,
  UserFiltersInput,
} from './admin.model.js';
import {
  listUsers,
  updateUserRole,
  type AdminUserPage,
  type AdminUserRow,
} from './admin.service.js';

function toUserGql(row: AdminUserRow): AdminUserGql {
  const user = new AdminUserGql();
  user.id = row.id;
  user.name = row.name;
  user.email = row.email;
  user.emailVerified = row.emailVerified;
  user.role = row.role as RoleGql;
  user.createdAt = row.createdAt;
  user.lockedUntil = row.lockedUntil;
  return user;
}

function toPageGql(page: AdminUserPage): AdminUserPageGql {
  const result = new AdminUserPageGql();
  result.items = page.items.map(toUserGql);
  result.total = page.total;
  result.page = page.page;
  result.pageSize = page.pageSize;
  result.pageInfo = toPageInfoGql(page.pageInfo, new PageInfoGql());
  return result;
}

interface GraphQLContext {
  req?: {
    ip?: string;
    headers?: Record<string, string | string[] | undefined>;
  };
}

function requestIp(ctx: GraphQLContext): string {
  const forwarded = ctx.req?.headers?.['x-forwarded-for'];
  const first = Array.isArray(forwarded)
    ? forwarded[0]
    : forwarded?.split(',')[0]?.trim();
  return ctx.req?.ip ?? first ?? 'unknown';
}

/**
 * F1-07 / RF-001: administracion de usuarios y roles.
 * Todo el resolutor exige sesion y rol ADMINISTRATOR; el servicio repite
 * las validaciones de negocio (defensa en profundidad).
 */
@Resolver(() => AdminUserGql)
@UseGuards(SessionGuard, RolesGuard)
export class AdminResolver {
  @Query(() => AdminUserPageGql)
  @Roles(ROLES.ADMINISTRATOR)
  async users(
    @Args('filters', { type: () => UserFiltersInput, nullable: true })
    filters?: UserFiltersInput,
    @Args('page', { type: () => Int, defaultValue: 1 }) page = 1,
    @Args('pageSize', { type: () => Int, defaultValue: 20 }) pageSize = 20,
    @Args('sortBy', { type: () => String, nullable: true })
    sortBy?: string,
    @Args('sortDir', { type: () => SortDirectionGql, nullable: true })
    sortDir?: SortDirectionGql,
  ): Promise<AdminUserPageGql> {
    const result = await listUsers(
      {
        role: filters?.role ?? null,
        search: filters?.search ?? null,
        emailVerified: filters?.emailVerified ?? null,
        lockedOnly: filters?.lockedOnly ?? null,
      },
      page,
      pageSize,
      { sortBy, sortDir },
    );
    return toPageGql(result);
  }

  @Mutation(() => AdminUserGql)
  @Roles(ROLES.ADMINISTRATOR)
  async updateUserRole(
    @Args('userId', { type: () => ID }) userId: string,
    @Args('role', { type: () => RoleGql }) role: RoleGql,
    @CurrentUser() user: AuthenticatedUser,
    @Context() context: GraphQLContext,
  ): Promise<AdminUserGql> {
    const updated = await updateUserRole(
      user,
      userId,
      role,
      requestIp(context),
    );
    return toUserGql(updated);
  }
}
