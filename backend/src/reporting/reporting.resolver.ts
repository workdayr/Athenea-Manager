import { UseGuards } from '@nestjs/common';
import { Args, Query, Resolver } from '@nestjs/graphql';
import { GraphQLError } from 'graphql';
import { ROLES } from '../auth/roles.constants.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { CurrentUser } from '../projects/current-user.decorator.js';
import {
  SessionGuard,
  type AuthenticatedUser,
} from '../projects/session.guard.js';
import {
  CoordinatorDashboardGql,
  ReportFiltersInput,
  StatisticalReportGql,
} from './reporting.model.js';
import { ReportError, ReportingService } from './reporting.service.js';

function toGraphQLError(error: unknown): never {
  if (error instanceof ReportError) {
    throw new GraphQLError(error.message, {
      extensions: { code: error.code, field: error.field ?? null },
    });
  }
  if (
    typeof error === 'object' &&
    error !== null &&
    typeof (error as { code?: unknown }).code === 'string'
  ) {
    const domain = error as { code: string; message: string; field?: string };
    throw new GraphQLError(domain.message, {
      extensions: { code: domain.code, field: domain.field ?? null },
    });
  }
  throw error;
}

/**
 * RF-008 / UC-009: dashboard institucional y reportes estadisticos.
 *
 * RF-001: Coordinacion y Administracion tienen acceso completo; el Comite
 * conserva su vista de seguimiento, pero el servicio devuelve el
 * presupuesto como null (la UI lo oculta). Cualquier otro rol es rechazado
 * por RolesGuard antes de llegar al servicio.
 */
@Resolver()
@UseGuards(SessionGuard, RolesGuard)
export class ReportingResolver {
  constructor(private readonly reportingService: ReportingService) {}

  @Query(() => CoordinatorDashboardGql)
  @Roles(ROLES.ADMINISTRATOR, ROLES.COORDINATOR, ROLES.COMMITTEE)
  async coordinatorDashboard(
    @Args('filters', {
      type: () => ReportFiltersInput,
      nullable: true,
    })
    filters: ReportFiltersInput | null,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CoordinatorDashboardGql> {
    try {
      return await this.reportingService.coordinatorDashboard(user, filters);
    } catch (error) {
      toGraphQLError(error);
    }
  }

  @Query(() => StatisticalReportGql)
  @Roles(ROLES.ADMINISTRATOR, ROLES.COORDINATOR, ROLES.COMMITTEE)
  async statisticalReport(
    @Args('filters', {
      type: () => ReportFiltersInput,
      nullable: true,
    })
    filters: ReportFiltersInput | null,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<StatisticalReportGql> {
    try {
      return await this.reportingService.statisticalReport(user, filters);
    } catch (error) {
      toGraphQLError(error);
    }
  }
}
