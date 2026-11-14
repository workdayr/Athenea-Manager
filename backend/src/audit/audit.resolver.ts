import { UseGuards } from '@nestjs/common';
import { Args, Int, Query, Resolver } from '@nestjs/graphql';
import { ROLES } from '../auth/roles.constants.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { SessionGuard } from '../projects/session.guard.js';
import {
  PageInfoGql,
  SortDirectionGql,
} from '../common/pagination/pagination.model.js';
import { toPageInfoGql } from '../common/pagination/pagination.policy.js';
import {
  AuditLogFiltersInput,
  AuditLogGql,
  AuditLogPageGql,
} from './audit.model.js';
import { AuditService, type AuditLogPage } from './audit.service.js';

function toGql(row: AuditLogPage['items'][number]): AuditLogGql {
  const item = new AuditLogGql();
  item.logId = row.log_id;
  item.actorId = row.actor_id;
  item.actorName = row.actor_name;
  item.action = row.action;
  item.targetId = row.target_id;
  item.sourceIp = row.source_ip;
  item.timestamp = row.timestamp;
  return item;
}

/**
 * F1-08 / RF-017: consulta de auditoria para Administracion y Coordinacion.
 * La UI dedicada se entrega en un sprint posterior; esta query ya respeta
 * roles, filtros y paginacion.
 */
@Resolver()
@UseGuards(SessionGuard, RolesGuard)
export class AuditResolver {
  constructor(private readonly auditService: AuditService) {}

  @Query(() => AuditLogPageGql)
  @Roles(ROLES.ADMINISTRATOR, ROLES.COORDINATOR)
  async auditLog(
    @Args('filters', { type: () => AuditLogFiltersInput, nullable: true })
    filters: AuditLogFiltersInput,
    @Args('page', { type: () => Int, nullable: true, defaultValue: 1 })
    page: number,
    @Args('pageSize', { type: () => Int, nullable: true, defaultValue: 20 })
    pageSize: number,
    @Args('sortBy', { type: () => String, nullable: true })
    sortBy?: string,
    @Args('sortDir', { type: () => SortDirectionGql, nullable: true })
    sortDir?: SortDirectionGql,
  ): Promise<AuditLogPageGql> {
    const result = await this.auditService.query(
      {
        actorId: filters?.actorId,
        action: filters?.action,
        targetId: filters?.targetId,
        from: filters?.from,
        to: filters?.to,
      },
      page,
      pageSize,
      { sortBy, sortDir },
    );
    const gql = new AuditLogPageGql();
    gql.items = result.items.map(toGql);
    gql.total = result.total;
    gql.page = result.page;
    gql.pageSize = result.pageSize;
    gql.pageInfo = toPageInfoGql(result.pageInfo, new PageInfoGql());
    return gql;
  }
}
