import { gql } from '@apollo/client';
import { getApolloClient } from './apollo-client';

/** F1-08 / RF-017: bitacora de auditoria institucional. */

export interface AuditLogEntry {
  logId: number;
  actorId: string;
  actorName: string;
  action: string;
  targetId: string;
  sourceIp: string;
  timestamp: string;
}

export interface AuditLogPage {
  items: AuditLogEntry[];
  total: number;
  page: number;
  pageSize: number;
  pageInfo: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export interface AuditFilters {
  actorId?: string;
  action?: string;
  targetId?: string;
  from?: string;
  to?: string;
}

export const AUDIT_LOG_QUERY = gql`
  query AuditLog(
    $filters: AuditLogFiltersInput
    $page: Int
    $pageSize: Int
  ) {
    auditLog(filters: $filters, page: $page, pageSize: $pageSize) {
      items {
        logId
        actorId
        actorName
        action
        targetId
        sourceIp
        timestamp
      }
      total
      page
      pageSize
      pageInfo {
        page
        pageSize
        total
        totalPages
        hasNextPage
        hasPreviousPage
      }
    }
  }
`;

export async function fetchAuditLog(
  filters: AuditFilters,
  page = 1,
  pageSize = 20,
): Promise<AuditLogPage> {
  const normalized: Record<string, string> = {};
  if (filters.actorId?.trim()) normalized.actorId = filters.actorId.trim();
  if (filters.action?.trim()) normalized.action = filters.action.trim();
  if (filters.targetId?.trim()) normalized.targetId = filters.targetId.trim();
  if (filters.from) {
    normalized.from = new Date(`${filters.from}T00:00:00`).toISOString();
  }
  if (filters.to) {
    normalized.to = new Date(`${filters.to}T23:59:59`).toISOString();
  }

  const result = await getApolloClient().query<{ auditLog: AuditLogPage }>({
    query: AUDIT_LOG_QUERY,
    variables: {
      filters: Object.keys(normalized).length > 0 ? normalized : null,
      page,
      pageSize,
    },
    fetchPolicy: 'network-only',
  });
  if (!result.data?.auditLog) {
    throw new Error('El servidor no devolvio la bitacora.');
  }
  return result.data.auditLog;
}

export function auditErrorMessage(error: unknown): string {
  const message = (
    error as { graphQLErrors?: Array<{ message?: string }> }
  )?.graphQLErrors?.[0]?.message;
  if (message) {
    return message;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'No se pudo consultar la bitacora. Intenta de nuevo.';
}
