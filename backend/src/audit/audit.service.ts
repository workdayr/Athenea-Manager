import { Injectable } from '@nestjs/common';
import { prisma } from '../db/prisma.js';
import {
  buildPageInfo,
  normalizePageArgs,
  orderByFrom,
  type PageArgs,
  type PageInfo,
} from '../common/pagination/pagination.policy.js';
import {
  normalizeAuditQuery,
  type AuditFilters,
} from './audit.policy.js';

/** F2-03: campos de ordenamiento de la bitacora. */
const AUDIT_SORT_FIELDS = ['timestamp', 'action', 'actorId'] as const;
const AUDIT_SORT_COLUMNS: Record<string, string> = {
  timestamp: 'timestamp',
  action: 'action',
  actorId: 'actor_id',
};

export interface AuditLogRow {
  log_id: number;
  actor_id: string;
  actor: { name: string };
  action: string;
  target_id: string;
  source_ip: string;
  timestamp: Date;
}

export interface AuditLogPage {
  items: {
    log_id: number;
    actor_id: string;
    actor_name: string;
    action: string;
    target_id: string;
    source_ip: string;
    timestamp: Date;
  }[];
  total: number;
  page: number;
  pageSize: number;
  pageInfo: PageInfo;
}

@Injectable()
export class AuditService {
  /** RF-017 / F1-08: consulta filtrada y paginada de `Audit_Log`. */
  async query(
    filters: AuditFilters = {},
    page = 1,
    pageSize = 20,
    paging: PageArgs = {},
  ): Promise<AuditLogPage> {
    const ordering = normalizePageArgs(
      { ...paging, page, pageSize },
      AUDIT_SORT_FIELDS,
      { sortBy: 'timestamp', sortDir: 'desc' },
    );
    const normalized = normalizeAuditQuery(
      filters,
      ordering.page,
      ordering.pageSize,
    );
    const orderBy = orderByFrom(ordering, AUDIT_SORT_COLUMNS) ?? {
      timestamp: 'desc' as const,
    };
    const [rows, total] = await Promise.all([
      prisma.audit_Log.findMany({
        where: normalized.where,
        orderBy: orderBy as never,
        skip: ordering.skip,
        take: ordering.take,
        include: { actor: { select: { name: true } } },
      }),
      prisma.audit_Log.count({ where: normalized.where }),
    ]);

    const items = (rows as unknown as AuditLogRow[]).map((row) => ({
      log_id: row.log_id,
      actor_id: row.actor_id,
      actor_name: row.actor.name,
      action: row.action,
      target_id: row.target_id,
      source_ip: row.source_ip,
      timestamp: row.timestamp,
    }));

    return {
      items,
      total,
      page: normalized.page,
      pageSize: normalized.pageSize,
      pageInfo: buildPageInfo(ordering, total),
    };
  }
}
