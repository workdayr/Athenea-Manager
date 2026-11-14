import { Injectable } from '@nestjs/common';
import { prisma } from '../db/prisma.js';
import {
  normalizeAuditQuery,
  type AuditFilters,
} from './audit.policy.js';

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
}

@Injectable()
export class AuditService {
  /** RF-017 / F1-08: consulta filtrada y paginada de `Audit_Log`. */
  async query(
    filters: AuditFilters = {},
    page = 1,
    pageSize = 20,
  ): Promise<AuditLogPage> {
    const normalized = normalizeAuditQuery(filters, page, pageSize);
    const [rows, total] = await Promise.all([
      prisma.audit_Log.findMany({
        where: normalized.where,
        orderBy: { timestamp: 'desc' },
        skip: (normalized.page - 1) * normalized.pageSize,
        take: normalized.pageSize,
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
    };
  }
}
