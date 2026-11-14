import { UseGuards } from '@nestjs/common';
import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GraphQLError } from 'graphql';
import { ROLES } from '../auth/roles.constants.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { SortDirectionGql } from '../common/pagination/pagination.model.js';
import { CurrentUser } from '../projects/current-user.decorator.js';
import {
  SessionGuard,
  type AuthenticatedUser,
} from '../projects/session.guard.js';
import { remainingCallSlots } from './calls.policy.js';
import {
  allCalls,
  CallError,
  closeCall,
  closeExpiredCalls,
  createCall,
  getCall,
  openCalls,
  publishCall,
} from './calls.service.js';
import { CallGql, CallStatusGql, CreateCallInput } from './calls.model.js';

interface CallRow {
  call_id: number;
  title: string;
  description: string;
  date_published: Date | null;
  deadline: Date;
  application_cap: number;
  application_count: number;
  status: string;
}

function toGql(row: CallRow): CallGql {
  const call = new CallGql();
  call.callId = row.call_id;
  call.title = row.title;
  call.description = row.description;
  call.datePublished = row.date_published;
  call.deadline = row.deadline;
  call.applicationCap = row.application_cap;
  call.applicationCount = row.application_count;
  call.status = row.status as CallStatusGql;
  call.remainingSlots = remainingCallSlots({
    status: row.status,
    deadline: row.deadline,
    application_cap: row.application_cap,
    application_count: row.application_count,
  });
  return call;
}

function toGraphQLError(error: unknown): never {
  if (error instanceof CallError) {
    throw new GraphQLError(error.message, {
      extensions: { code: error.code, field: error.field ?? null },
    });
  }
  throw error;
}

/**
 * US 2.2 / RF-018: publicacion y consulta de convocatorias.
 *
 * RF-001: las mutaciones administrativas declaran `@Roles(ADMINISTRATOR)`;
 * `RolesGuard` corta antes de llegar al servicio. El servicio conserva
 * su propio `requireAdmin` como defensa en profundidad.
 */
@Resolver(() => CallGql)
@UseGuards(SessionGuard, RolesGuard)
export class CallsResolver {
  @Mutation(() => CallGql)
  @Roles(ROLES.ADMINISTRATOR)
  async createCall(
    @Args('input') input: CreateCallInput,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CallGql> {
    try {
      const row = (await createCall(user, {
        title: input.title,
        description: input.description,
        deadline: input.deadline,
        applicationCap: input.applicationCap,
      })) as unknown as CallRow;
      return toGql(row);
    } catch (error) {
      toGraphQLError(error);
    }
  }

  @Mutation(() => CallGql)
  @Roles(ROLES.ADMINISTRATOR)
  async publishCall(
    @Args('callId', { type: () => Int }) callId: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CallGql> {
    try {
      const row = (await publishCall(user, callId)) as unknown as CallRow;
      return toGql(row);
    } catch (error) {
      toGraphQLError(error);
    }
  }

  @Mutation(() => CallGql)
  @Roles(ROLES.ADMINISTRATOR)
  async closeCall(
    @Args('callId', { type: () => Int }) callId: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CallGql> {
    try {
      const row = (await closeCall(user, callId)) as unknown as CallRow;
      return toGql(row);
    } catch (error) {
      toGraphQLError(error);
    }
  }

  /** Disparo manual del cierre por deadline (el job lo hace cada minuto). */
  @Mutation(() => Int)
  @Roles(ROLES.ADMINISTRATOR)
  async closeExpiredCalls(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<number> {
    // Defense in depth: el guard ya bloquea, pero si alguien invoca el
    // resolver directamente, esta validacion sigue vigente.
    if (user.role !== ROLES.ADMINISTRATOR) {
      throw new GraphQLError(
        'Solo un Administrador puede ejecutar el cierre.',
        { extensions: { code: 'FORBIDDEN', field: null } },
      );
    }
    return closeExpiredCalls();
  }

  /**
   * F1-09: historial completo (abiertas y cerradas) para /calls.
   * Los borradores quedan reservados a ADMINISTRATOR.
   */
  @Query(() => [CallGql])
  async calls(
    @Args('status', { type: () => CallStatusGql, nullable: true })
    status: CallStatusGql | undefined,
    @CurrentUser() user: AuthenticatedUser,
    @Args('page', { type: () => Int, nullable: true }) page?: number,
    @Args('pageSize', { type: () => Int, nullable: true }) pageSize?: number,
    @Args('sortBy', { type: () => String, nullable: true }) sortBy?: string,
    @Args('sortDir', { type: () => SortDirectionGql, nullable: true })
    sortDir?: SortDirectionGql,
  ): Promise<CallGql[]> {
    const rows = (await allCalls(
      status ?? null,
      user.role === ROLES.ADMINISTRATOR,
      { page, pageSize, sortBy, sortDir },
    )) as unknown as CallRow[];
    return rows.map(toGql);
  }

  @Query(() => [CallGql])
  async openCalls(
    @Args('page', { type: () => Int, nullable: true }) page?: number,
    @Args('pageSize', { type: () => Int, nullable: true }) pageSize?: number,
    @Args('sortBy', { type: () => String, nullable: true }) sortBy?: string,
    @Args('sortDir', { type: () => SortDirectionGql, nullable: true })
    sortDir?: SortDirectionGql,
  ): Promise<CallGql[]> {
    const rows = (await openCalls(new Date(), {
      page,
      pageSize,
      sortBy,
      sortDir,
    })) as unknown as CallRow[];
    return rows.map(toGql);
  }

  @Query(() => CallGql, { nullable: true })
  async call(
    @Args('callId', { type: () => Int }) callId: number,
  ): Promise<CallGql | null> {
    const row = (await getCall(callId)) as unknown as CallRow | null;
    return row ? toGql(row) : null;
  }
}