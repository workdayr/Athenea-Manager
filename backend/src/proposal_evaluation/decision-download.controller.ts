import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  ParseIntPipe,
  Res,
  UseGuards,
} from '@nestjs/common';
import { GraphQLError } from 'graphql';
import type { Response } from 'express';
import { statSync } from 'node:fs';
import { CurrentUser } from '../projects/current-user.decorator.js';
import {
  SessionGuard,
  type AuthenticatedUser,
} from '../projects/session.guard.js';
import { DECISION_REPORT_ERROR_CODES } from './decision-report.constants.js';
import { getDecisionReportForDownload } from './decision-report.service.js';

/**
 * F1-10 / RF-019: descarga del dictamen PDF (REST con sesion Bearer).
 * GET /decisions/:evaluationId/report
 */
@Controller('decisions')
export class DecisionDownloadController {
  @Get(':evaluationId/report')
  @UseGuards(SessionGuard)
  async download(
    @Param('evaluationId', ParseIntPipe) evaluationId: number,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const report = await getDecisionReportForDownload(user, evaluationId);
      const stat = statSync(report.path);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Length', stat.size);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${report.fileName}"`,
      );
      res.sendFile(report.path);
    } catch (error) {
      if (error instanceof GraphQLError) {
        const code = error.extensions?.['code'];
        const status =
          code === DECISION_REPORT_ERROR_CODES.NOT_FOUND
            ? HttpStatus.NOT_FOUND
            : code === DECISION_REPORT_ERROR_CODES.FORBIDDEN
              ? HttpStatus.FORBIDDEN
              : HttpStatus.CONFLICT;
        throw new HttpException(error.message, status);
      }
      throw error;
    }
  }
}
