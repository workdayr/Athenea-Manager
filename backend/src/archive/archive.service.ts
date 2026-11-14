import { Injectable, Logger } from '@nestjs/common';
import { ROLES } from '../auth/roles.constants.js';
import { prisma } from '../db/prisma.js';
import { Prisma } from '../generated/prisma/client.js';
import { notifyRole } from '../notifications/notifications.service.js';
import {
  buildPageInfo,
  normalizePageArgs,
  type PageInfo,
} from '../common/pagination/pagination.policy.js';
import {
  ARCHIVE_ALERT_MESSAGE_MAX_LENGTH,
  ARCHIVE_BATCH_SIZE,
  ARCHIVE_TRANSACTION_TIMEOUT_MS,
} from './archive.constants.js';
import {
  buildArchiveSnapshot,
  hashArchiveSnapshot,
  type ArchiveProjectRow,
} from './archive.snapshot.js';

export type ArchiveSkipReason =
  | 'not_found'
  | 'not_closed'
  | 'already_archived';

export type ArchiveOutcome =
  | {
      status: 'archived';
      projectId: number;
      archiveId: number;
      snapshotHash: string;
    }
  | { status: 'skipped'; projectId: number; reason: ArchiveSkipReason }
  | { status: 'failed'; projectId: number; error: string };

export interface ArchiveBatchResult {
  scanned: number;
  archived: number;
  skipped: number;
  failed: number;
}

export interface ArchivedProjectRow {
  project_id: number;
  title: string;
  status: string;
  archived_at: Date;
  snapshot_hash: string;
}

export interface ArchivedProjectPage {
  items: ArchivedProjectRow[];
  total: number;
  page: number;
  pageSize: number;
  pageInfo: PageInfo;
}

export interface ArchiveAlertRow {
  alert_id: number;
  project_id: number | null;
  attempted_at: Date;
  error_message: string;
  resolved_at: Date | null;
}

interface LockedProjectRow {
  status: string;
  is_read_only: boolean;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function errorCode(error: unknown): string | null {
  if (
    typeof error === 'object' &&
    error !== null &&
    typeof (error as { code?: unknown }).code === 'string'
  ) {
    return (error as { code: string }).code;
  }
  return null;
}

function isUniqueConstraintError(error: unknown): boolean {
  return errorCode(error) === 'P2002';
}

/** Conflicto de serializacion: otra instancia archivo el mismo proyecto. */
function isSerializationError(error: unknown): boolean {
  return errorCode(error) === 'P2034';
}

/**
 * RF-020: archiva en modo solo lectura los proyectos que alcanzaron el
 * estado `Closed`.
 *
 * Cada proyecto se procesa dentro de una transaccion Serializable:
 * - se bloquea la fila con `SELECT ... FOR UPDATE`;
 * - se verifica que siga cerrado y sin archivar;
 * - se inserta el snapshot inmutable;
 * - se marcan `is_read_only` y `archived_at`.
 *
 * Cualquier fallo revierte la transaccion completa. La alerta se persiste
 * FUERA de la transaccion para que no se pierda con el rollback.
 */
@Injectable()
export class ProjectArchiveService {
  private readonly logger = new Logger(ProjectArchiveService.name);

  async archiveClosedProjects(): Promise<ArchiveBatchResult> {
    const summary: ArchiveBatchResult = {
      scanned: 0,
      archived: 0,
      skipped: 0,
      failed: 0,
    };

    try {
      // Paginacion por llave: un proyecto que falla no bloquea a los demas
      // ni se reintenta en bucle dentro de la misma ejecucion.
      let cursor = 0;
      for (;;) {
        const candidates = await prisma.project.findMany({
          where: {
            status: 'Closed',
            is_read_only: false,
            project_id: { gt: cursor },
          },
          select: { project_id: true },
          orderBy: { project_id: 'asc' },
          take: ARCHIVE_BATCH_SIZE,
        });
        if (candidates.length === 0) {
          break;
        }

        summary.scanned += candidates.length;
        for (const candidate of candidates) {
          const outcome = await this.archiveProject(candidate.project_id);
          if (outcome.status === 'archived') {
            summary.archived += 1;
          } else if (outcome.status === 'skipped') {
            summary.skipped += 1;
          } else {
            summary.failed += 1;
          }
        }

        cursor = candidates[candidates.length - 1].project_id;
        if (candidates.length < ARCHIVE_BATCH_SIZE) {
          break;
        }
      }

      return summary;
    } catch (error) {
      // Fallo global del job (p. ej. BD no disponible).
      await this.raiseAlert(null, error);
      throw error;
    }
  }

  async archiveProject(projectId: number): Promise<ArchiveOutcome> {
    return this.runArchive(projectId, 0);
  }

  private async runArchive(
    projectId: number,
    retry: number,
  ): Promise<ArchiveOutcome> {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const locked = await tx.$queryRaw<LockedProjectRow[]>`
            SELECT "status"::text AS status, "is_read_only" AS is_read_only
            FROM "Project"
            WHERE "project_id" = ${projectId}
            FOR UPDATE`;

          const row = locked[0];
          if (!row) {
            return {
              status: 'skipped',
              projectId,
              reason: 'not_found',
            } as const;
          }
          if (row.status !== 'Closed') {
            return {
              status: 'skipped',
              projectId,
              reason: 'not_closed',
            } as const;
          }
          if (row.is_read_only) {
            return {
              status: 'skipped',
              projectId,
              reason: 'already_archived',
            } as const;
          }

          const project = await tx.project.findUnique({
            where: { project_id: projectId },
            include: {
              call: { select: { title: true } },
              projectUsers: {
                select: {
                  project_role: true,
                  user: { select: { id: true, name: true } },
                },
                orderBy: { projectuser_id: 'asc' },
              },
              documents: { orderBy: { document_id: 'asc' } },
              milestones: {
                include: { assignee: { select: { name: true } } },
                orderBy: { milestone_id: 'asc' },
              },
              products: { orderBy: { product_id: 'asc' } },
              expenses: { orderBy: { expense_id: 'asc' } },
              evaluations: { orderBy: { evaluation_id: 'asc' } },
              conflicts: { orderBy: { conflict_id: 'asc' } },
            },
          });

          if (!project) {
            return {
              status: 'skipped',
              projectId,
              reason: 'not_found',
            } as const;
          }

          const archivedAt = new Date();
          const snapshot = buildArchiveSnapshot(
            project as unknown as ArchiveProjectRow,
            archivedAt,
          );
          const snapshotHash = hashArchiveSnapshot(snapshot);

          const archive = await tx.project_Archive.create({
            data: {
              project_id: projectId,
              snapshot: snapshot as unknown as Prisma.InputJsonValue,
              snapshot_hash: snapshotHash,
              archived_at: archivedAt,
            },
          });

          await tx.project.update({
            where: { project_id: projectId },
            data: { is_read_only: true, archived_at: archivedAt },
          });

          return {
            status: 'archived',
            projectId,
            archiveId: archive.archive_id,
            snapshotHash,
          } as const;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          timeout: ARCHIVE_TRANSACTION_TIMEOUT_MS,
        },
      );
    } catch (error) {
      // Otra instancia pudo archivar el proyecto entre el listado y el lock.
      if (isUniqueConstraintError(error)) {
        return {
          status: 'skipped',
          projectId,
          reason: 'already_archived',
        };
      }
      if (isSerializationError(error) && retry === 0) {
        // Un conflicto Serializable es transitorio: reintenta una vez.
        return this.runArchive(projectId, retry + 1);
      }

      const message = errorMessage(error);
      await this.raiseAlert(projectId, error);
      return { status: 'failed', projectId, error: message };
    }
  }

  /** RF-020: expedientes archivados con su hash y fecha de congelamiento. */
  async listArchived(page = 1, pageSize = 20): Promise<ArchivedProjectPage> {
    const ordering = normalizePageArgs({ page, pageSize }, [], {
      sortDir: 'desc',
    });
    const [rows, total] = await Promise.all([
      prisma.project_Archive.findMany({
        orderBy: { archived_at: 'desc' },
        skip: ordering.skip,
        take: ordering.take,
        include: {
          project: { select: { project_id: true, title: true, status: true } },
        },
      }),
      prisma.project_Archive.count(),
    ]);

    return {
      items: rows.map((row) => ({
        project_id: row.project.project_id,
        title: row.project.title,
        status: row.project.status,
        archived_at: row.archived_at,
        snapshot_hash: row.snapshot_hash,
      })),
      total,
      page: ordering.page,
      pageSize: ordering.pageSize,
      pageInfo: buildPageInfo(ordering, total),
    };
  }

  /** Alertas de archivado; por defecto solo las no resueltas. */
  async listAlerts(onlyUnresolved = true): Promise<ArchiveAlertRow[]> {
    return prisma.archive_Alert.findMany({
      where: onlyUnresolved ? { resolved_at: null } : {},
      orderBy: { attempted_at: 'desc' },
      take: 100,
    }) as unknown as Promise<ArchiveAlertRow[]>;
  }

  /**
   * Persiste la alerta y notifica a todos los administradores.
   * Nunca lanza: un fallo al alertar no debe ocultar el fallo original.
   */
  private async raiseAlert(
    projectId: number | null,
    error: unknown,
  ): Promise<void> {
    const message = errorMessage(error).slice(
      0,
      ARCHIVE_ALERT_MESSAGE_MAX_LENGTH,
    );
    const target =
      projectId === null ? 'job global' : `proyecto ${projectId}`;

    this.logger.error(`Fallo de archivado (${target}): ${message}`);

    try {
      await prisma.archive_Alert.create({
        data: { project_id: projectId, error_message: message },
      });
    } catch (alertError) {
      this.logger.error(
        'No se pudo persistir la alerta de archivado.',
        alertError as Error,
      );
    }

    try {
      const notified = await notifyRole(prisma, ROLES.ADMINISTRATOR, {
        type: 'Archive',
        title: 'Fallo de archivado de proyecto',
        message: `No se pudo archivar ${target}: ${message}`,
        link: '/dashboard',
      });
      if (notified.length === 0) {
        this.logger.warn(
          'No hay administradores registrados para recibir la alerta.',
        );
      }
    } catch (notifyError) {
      this.logger.error(
        'No se pudo notificar a los administradores.',
        notifyError as Error,
      );
    }
  }
}
