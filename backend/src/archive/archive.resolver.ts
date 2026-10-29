import { UseGuards } from '@nestjs/common';
import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GraphQLError } from 'graphql';
import { ROLES } from '../auth/roles.constants.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { SessionGuard } from '../projects/session.guard.js';
import { ARCHIVE_ERROR_CODES } from './archive.constants.js';
import {
  ArchiveAlertGql,
  ArchiveBatchResultGql,
  ArchiveOutcomeGql,
} from './archive.model.js';
import {
  ProjectArchiveService,
  type ArchiveAlertRow,
  type ArchiveOutcome,
} from './archive.service.js';

function toAlertGql(row: ArchiveAlertRow): ArchiveAlertGql {
  const alert = new ArchiveAlertGql();
  alert.alertId = row.alert_id;
  alert.projectId = row.project_id;
  alert.attemptedAt = row.attempted_at;
  alert.errorMessage = row.error_message;
  alert.resolvedAt = row.resolved_at;
  return alert;
}

function toOutcomeGql(outcome: ArchiveOutcome): ArchiveOutcomeGql {
  const gql = new ArchiveOutcomeGql();
  gql.status = outcome.status;
  gql.projectId = outcome.projectId;
  gql.reason = outcome.status === 'skipped' ? outcome.reason : null;
  gql.error = outcome.status === 'failed' ? outcome.error : null;
  gql.snapshotHash =
    outcome.status === 'archived' ? outcome.snapshotHash : null;
  gql.archiveId = outcome.status === 'archived' ? outcome.archiveId : null;
  return gql;
}

/**
 * RF-020: operaciones administrativas del archivo institucional.
 *
 * El archivado automatico corre en `ProjectArchiveScheduler`; estas
 * operaciones permiten al Administrador consultar alertas y reintentar
 * manualmente un proyecto o el lote completo.
 */
@Resolver()
@UseGuards(SessionGuard, RolesGuard)
export class ArchiveResolver {
  constructor(private readonly archiveService: ProjectArchiveService) {}

  @Query(() => [ArchiveAlertGql])
  @Roles(ROLES.ADMINISTRATOR)
  async archiveAlerts(
    @Args('onlyUnresolved', {
      type: () => Boolean,
      nullable: true,
      defaultValue: true,
    })
    onlyUnresolved: boolean,
  ): Promise<ArchiveAlertGql[]> {
    const rows = await this.archiveService.listAlerts(onlyUnresolved);
    return rows.map(toAlertGql);
  }

  @Mutation(() => ArchiveOutcomeGql)
  @Roles(ROLES.ADMINISTRATOR)
  async archiveProject(
    @Args('projectId', { type: () => Int }) projectId: number,
  ): Promise<ArchiveOutcomeGql> {
    return toOutcomeGql(await this.archiveService.archiveProject(projectId));
  }

  @Mutation(() => ArchiveBatchResultGql)
  @Roles(ROLES.ADMINISTRATOR)
  async archiveClosedProjects(): Promise<ArchiveBatchResultGql> {
    try {
      const summary = await this.archiveService.archiveClosedProjects();
      const gql = new ArchiveBatchResultGql();
      gql.scanned = summary.scanned;
      gql.archived = summary.archived;
      gql.skipped = summary.skipped;
      gql.failed = summary.failed;
      return gql;
    } catch (error) {
      throw new GraphQLError(
        'No se pudo ejecutar el archivado de proyectos cerrados.',
        {
          extensions: {
            code: ARCHIVE_ERROR_CODES.ARCHIVE_FAILED,
            field: null,
            cause: error instanceof Error ? error.message : String(error),
          },
        },
      );
    }
  }
}
