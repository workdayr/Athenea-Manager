import { Injectable, Logger } from '@nestjs/common';
import { unlink } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { ROLES } from '../auth/roles.constants.js';
import { prisma } from '../db/prisma.js';
import { notifyUser } from '../notifications/notifications.service.js';
import {
  ETHICS_ERROR_CODES,
  RETENTION_BATCH_SIZE,
  RETENTION_TRANSACTION_TIMEOUT_MS,
  resolveRetentionNoticeDays,
} from './project-ethics.constants.js';
import { assertProjectWritable } from './project-write-guard.js';
import type { AuthenticatedUser } from './session.guard.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export class ProjectEthicsError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly httpStatus: number,
    readonly field?: string,
  ) {
    super(message);
  }
}

function fail(
  code: string,
  message: string,
  httpStatus: number,
  field?: string,
): never {
  throw new ProjectEthicsError(code, message, httpStatus, field);
}

export interface AnonymizationCertification {
  projectId: number;
  certified: boolean;
  certifiedAt: Date;
}

export interface RetentionBatchResult {
  scanned: number;
  noticesSent: number;
  deleted: number;
  failed: number;
}

interface LockedProjectRow {
  project_id: number;
  status: string;
  research_involves_humans: boolean;
  retention_delete_at: Date | null;
  retention_deleted_at: Date | null;
}

function uploadBaseDir(): string {
  return resolve(process.env['UPLOAD_DIR'] ?? join(process.cwd(), 'uploads'));
}

/** BR-013: borra un archivo solo si esta dentro de UPLOAD_DIR. */
async function safeUnlink(fileUrl: string): Promise<void> {
  const base = uploadBaseDir();
  const target = resolve(fileUrl);
  if (target !== base && !target.startsWith(`${base}${sep}`)) {
    throw new ProjectEthicsError(
      ETHICS_ERROR_CODES.RETENTION_FAILED,
      'La ruta del archivo queda fuera del directorio de cargas.',
      500,
    );
  }
  try {
    await unlink(target);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return;
    }
    throw error;
  }
}

/**
 * F1-11 / BR-012, BR-013: certificacion de anonimizacion y retencion segura.
 */
@Injectable()
export class ProjectEthicsService {
  private readonly logger = new Logger(ProjectEthicsService.name);

  /** BR-012: el PI certifica que los datasets estan anonimizados. */
  async certifyAnonymization(
    user: AuthenticatedUser,
    projectId: number,
    ip: string,
  ): Promise<AnonymizationCertification> {
    const project = await prisma.project.findUnique({
      where: { project_id: projectId },
    });
    if (!project) {
      fail(ETHICS_ERROR_CODES.NOT_FOUND, 'El proyecto no existe.', 404);
    }
    assertProjectWritable(project as { is_read_only?: boolean | null });

    const membership = await prisma.project_User.findFirst({
      where: {
        project_id: projectId,
        user_id: user.id,
        project_role: 'Principal_Investigator',
      },
      select: { projectuser_id: true },
    });
    if (!membership) {
      fail(
        ETHICS_ERROR_CODES.FORBIDDEN,
        'Solo el Investigador Principal del proyecto puede certificar la anonimizacion.',
        403,
      );
    }

    if (!project.research_involves_humans) {
      fail(
        ETHICS_ERROR_CODES.NOT_APPLICABLE,
        'El proyecto no involucra seres humanos; la certificacion de anonimizacion no aplica (BR-012).',
        409,
      );
    }

    const now = new Date();
    await prisma.project.update({
      where: { project_id: projectId },
      data: {
        anonymization_certified: true,
        anonymization_certified_at: now,
        anonymization_certified_by: user.id,
      },
    });
    await prisma.audit_Log.create({
      data: {
        actor_id: user.id,
        action: 'certify_project_anonymization',
        target_id: String(projectId),
        source_ip: ip,
      },
    });

    return { projectId, certified: true, certifiedAt: now };
  }

  /**
   * BR-013: envia avisos 30 dias antes y ejecuta el borrado seguro de los
   * datos operativos de proyectos con humanos cuya retencion vencio.
   */
  async runRetentionScan(now: Date = new Date()): Promise<RetentionBatchResult> {
    const noticeDays = resolveRetentionNoticeDays();
    const noticeCutoff = new Date(now.getTime() + noticeDays * DAY_MS);

    const noticeCandidates = await prisma.project.findMany({
      where: {
        research_involves_humans: true,
        status: { in: ['Completed', 'Closed'] },
        retention_delete_at: { gt: now, lte: noticeCutoff },
        retention_notified_at: null,
        retention_deleted_at: null,
      },
      select: { project_id: true, title: true, retention_delete_at: true },
      orderBy: { project_id: 'asc' },
      take: RETENTION_BATCH_SIZE,
    });

    let noticesSent = 0;
    for (const candidate of noticeCandidates) {
      const claimed = await prisma.project.updateMany({
        where: {
          project_id: candidate.project_id,
          research_involves_humans: true,
          status: { in: ['Completed', 'Closed'] },
          retention_delete_at: { gt: now, lte: noticeCutoff },
          retention_notified_at: null,
          retention_deleted_at: null,
        },
        data: { retention_notified_at: now },
      });
      if (claimed.count !== 1) {
        continue;
      }

      const pi = await prisma.project_User.findFirst({
        where: {
          project_id: candidate.project_id,
          project_role: 'Principal_Investigator',
        },
        select: { user_id: true },
      });
      if (pi) {
        const deleteDate = candidate.retention_delete_at
          ? candidate.retention_delete_at.toISOString().slice(0, 10)
          : 'la fecha programada';
        await notifyUser(prisma, pi.user_id, {
          type: 'Retention',
          title: 'Aviso de retencion de datos',
          message: `Los datos operativos del proyecto "${candidate.title}" se eliminaran el ${deleteDate} (BR-013).`,
          link: `/projects/${candidate.project_id}/documents`,
        });
      }
      noticesSent += 1;
    }

    const deleteCandidates = await prisma.project.findMany({
      where: {
        research_involves_humans: true,
        status: { in: ['Completed', 'Closed'] },
        retention_delete_at: { lte: now },
        retention_deleted_at: null,
      },
      select: { project_id: true },
      orderBy: { project_id: 'asc' },
      take: RETENTION_BATCH_SIZE,
    });

    let deleted = 0;
    let failed = 0;
    for (const candidate of deleteCandidates) {
      try {
        const removed = await this.deleteProjectData(candidate.project_id, now);
        if (removed) {
          deleted += 1;
        }
      } catch (error) {
        failed += 1;
        this.logger.error(
          `Fallo la retencion segura del proyecto ${candidate.project_id}.`,
          error as Error,
        );
      }
    }

    return {
      scanned: noticeCandidates.length + deleteCandidates.length,
      noticesSent,
      deleted,
      failed,
    };
  }

  /**
   * Borra archivos y filas operativas en una transaccion con bloqueo de la
   * fila del proyecto. Los archivos se eliminan antes de las filas para que
   * un fallo de disco deje el proyecto intacto y el job pueda reintentar.
   */
  private async deleteProjectData(
    projectId: number,
    now: Date,
  ): Promise<boolean> {
    return prisma.$transaction(
      async (tx) => {
        const rows = await tx.$queryRaw<LockedProjectRow[]>`
          SELECT "project_id", "status", "research_involves_humans",
                 "retention_delete_at", "retention_deleted_at"
          FROM "Project"
          WHERE "project_id" = ${projectId}
          FOR UPDATE`;
        const project = rows[0];
        if (!project) {
          return false;
        }
        if (!project.research_involves_humans) {
          return false;
        }
        if (project.status !== 'Completed' && project.status !== 'Closed') {
          return false;
        }
        if (
          !project.retention_delete_at ||
          project.retention_delete_at.getTime() > now.getTime()
        ) {
          return false;
        }
        if (project.retention_deleted_at) {
          return false;
        }

        const documents = await tx.projectDocument.findMany({
          where: { project_id: projectId },
          select: { file_url: true },
        });
        const pi = await tx.project_User.findFirst({
          where: {
            project_id: projectId,
            project_role: 'Principal_Investigator',
          },
          select: { user_id: true },
        });
        const admin = pi
          ? null
          : await tx.user.findFirst({
              where: { role: ROLES.ADMINISTRATOR },
              select: { id: true },
            });
        const actorId = pi?.user_id ?? admin?.id;
        if (!actorId) {
          throw new ProjectEthicsError(
            ETHICS_ERROR_CODES.RETENTION_FAILED,
            'No hay un usuario responsable para auditar el borrado.',
            500,
          );
        }

        for (const document of documents) {
          await safeUnlink(document.file_url);
        }

        await tx.projectDocument.deleteMany({ where: { project_id: projectId } });
        await tx.milestone.deleteMany({ where: { project_id: projectId } });
        await tx.product.deleteMany({ where: { project_id: projectId } });
        await tx.expense.deleteMany({ where: { project_id: projectId } });
        await tx.project_User.deleteMany({ where: { project_id: projectId } });
        // BR-013 prevalece sobre RF-020: el snapshot no debe conservar una
        // copia de los datos operativos que se acaban de destruir.
        await tx.project_Archive.deleteMany({ where: { project_id: projectId } });

        await tx.project.update({
          where: { project_id: projectId },
          data: {
            retention_deleted_at: now,
            retention_notified_at: now,
          },
        });
        await tx.audit_Log.create({
          data: {
            actor_id: actorId,
            action: `retention_data_destroyed:${projectId}`,
            target_id: String(projectId),
            source_ip: 'system',
          },
        });

        if (pi) {
          await notifyUser(tx, pi.user_id, {
            type: 'Retention',
            title: 'Datos del proyecto eliminados',
            message: `Se eliminaron de forma segura los datos operativos del proyecto #${projectId} (BR-013).`,
            link: '/dashboard',
          });
        }

        return true;
      },
      { timeout: RETENTION_TRANSACTION_TIMEOUT_MS },
    );
  }
}
