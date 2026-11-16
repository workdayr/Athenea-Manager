import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { PAGINATION_MAX_PAGE_SIZE } from '../common/pagination/pagination.policy.js';
import {
  SessionGuard,
  type AuthenticatedUser,
} from '../projects/session.guard.js';
import { CurrentUser } from '../projects/current-user.decorator.js';
import type { ReportFiltersInput } from './reporting.model.js';
import { ReportingService } from './reporting.service.js';
import {
  buildCoordinatorCsv,
  buildStatisticalCsv,
  reportFiltersLabel,
} from './reporting.export.js';
import {
  renderCoordinatorReportPdf,
  renderStatisticalReportPdf,
} from './reporting.export.pdf.js';

const EXPORT_ROLES = ['ADMINISTRATOR', 'COORDINATOR', 'COMMITTEE'];
const MAX_EXPORT_PAGES = 100;

type ExportFormat = 'csv' | 'pdf';

function parseFilters(query: Record<string, unknown>): ReportFiltersInput {
  const filters: ReportFiltersInput = {};
  if (typeof query['year'] === 'string' && query['year'].trim()) {
    filters.year = Number(query['year']);
  }
  if (typeof query['from'] === 'string' && query['from']) {
    filters.from = new Date(query['from']);
  }
  if (typeof query['to'] === 'string' && query['to']) {
    filters.to = new Date(query['to']);
  }
  if (typeof query['callId'] === 'string' && query['callId'].trim()) {
    filters.callId = Number(query['callId']);
  }
  if (typeof query['search'] === 'string' && query['search'].trim()) {
    filters.search = query['search'].trim();
  }
  if (typeof query['statuses'] === 'string' && query['statuses'].trim()) {
    filters.statuses = query['statuses']
      .split(',')
      .map((status) => status.trim())
      .filter((status) => status.length > 0) as never;
  }
  return filters;
}

function parseFormat(query: Record<string, unknown>): ExportFormat {
  const format = typeof query['format'] === 'string' ? query['format'] : 'csv';
  if (format !== 'csv' && format !== 'pdf') {
    throw new HttpException(
      'Formato no soportado. Usa csv o pdf.',
      HttpStatus.BAD_REQUEST,
    );
  }
  return format;
}

function requireExporter(user: AuthenticatedUser): void {
  if (!EXPORT_ROLES.includes(user.role)) {
    throw new HttpException(
      'No tienes permisos para exportar este reporte.',
      HttpStatus.FORBIDDEN,
    );
  }
}

function sendFile(
  res: Response,
  content: Buffer,
  format: ExportFormat,
  fileName: string,
): void {
  res.setHeader(
    'Content-Type',
    format === 'pdf'
      ? 'application/pdf'
      : 'text/csv; charset=utf-8',
  );
  res.setHeader('Content-Length', content.length);
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${fileName}"`,
  );
  res.send(content);
}

/**
 * F2-05 / RF-008: exportacion CSV/PDF del dashboard y del reporte
 * estadistico. Respeta los filtros de la query, la visibilidad BR-007 y
 * oculta el presupuesto al Comité (el servicio ya lo entrega en null).
 */
@Controller('reports')
export class ReportingExportController {
  constructor(private readonly reportingService: ReportingService) {}

  @Get('coordinator/export')
  @UseGuards(SessionGuard)
  async exportCoordinator(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: Record<string, unknown>,
    @Res() res: Response,
  ): Promise<void> {
    try {
      requireExporter(user);
      const format = parseFormat(query);
      const filters = parseFilters(query);

      const first = await this.reportingService.coordinatorDashboard(user, {
        ...filters,
        page: 1,
        pageSize: PAGINATION_MAX_PAGE_SIZE,
      });
      const projects = [...first.projects];
      const pages = Math.min(first.totalPages, MAX_EXPORT_PAGES);
      for (let page = 2; page <= pages; page += 1) {
        const next = await this.reportingService.coordinatorDashboard(user, {
          ...filters,
          page,
          pageSize: PAGINATION_MAX_PAGE_SIZE,
        });
        projects.push(...next.projects);
      }
      const data = { ...first, projects };

      const year = filters.year ?? new Date().getFullYear();
      if (format === 'pdf') {
        const pdf = await renderCoordinatorReportPdf(
          data,
          reportFiltersLabel(filters),
        );
        sendFile(res, pdf, 'pdf', `athenea-informe-${year}.pdf`);
        return;
      }
      sendFile(
        res,
        Buffer.from(buildCoordinatorCsv(data, filters), 'utf8'),
        'csv',
        `athenea-proyectos-${year}.csv`,
      );
    } catch (error) {
      this.rethrowHttp(error);
    }
  }

  @Get('statistical/export')
  @UseGuards(SessionGuard)
  async exportStatistical(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: Record<string, unknown>,
    @Res() res: Response,
  ): Promise<void> {
    try {
      requireExporter(user);
      const format = parseFormat(query);
      const filters = parseFilters(query);
      const data = await this.reportingService.statisticalReport(
        user,
        filters,
      );
      const year = filters.year ?? new Date().getFullYear();

      if (format === 'pdf') {
        const pdf = await renderStatisticalReportPdf(
          data,
          reportFiltersLabel(filters),
        );
        sendFile(res, pdf, 'pdf', `athenea-estadistico-${year}.pdf`);
        return;
      }
      sendFile(
        res,
        Buffer.from(buildStatisticalCsv(data, filters), 'utf8'),
        'csv',
        `athenea-estadistico-${year}.csv`,
      );
    } catch (error) {
      this.rethrowHttp(error);
    }
  }

  private rethrowHttp(error: unknown): never {
    if (error instanceof HttpException) {
      throw error;
    }
    // Los errores de validacion/filtros del servicio se traducen a 400.
    if (
      typeof error === 'object' &&
      error !== null &&
      typeof (error as { code?: unknown }).code === 'string'
    ) {
      const domain = error as { message?: string };
      throw new HttpException(
        domain.message ?? 'No fue posible generar el reporte.',
        HttpStatus.BAD_REQUEST,
      );
    }
    throw error;
  }
}
