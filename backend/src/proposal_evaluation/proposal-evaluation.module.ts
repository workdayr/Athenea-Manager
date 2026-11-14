import { Module } from '@nestjs/common';
import { DecisionDownloadController } from './decision-download.controller.js';
import { DecisionReportScheduler } from './decision-report.scheduler.js';
import { ProposalEvaluationResolver } from './proposal-evaluation.resolver.js';

/**
 * RF-019 / UC-003: evaluacion de propuestas, alertas BR-011, regla
 * departamental BR-004 y dictamen PDF asincrono (F1-10).
 */
@Module({
  controllers: [DecisionDownloadController],
  providers: [ProposalEvaluationResolver, DecisionReportScheduler],
})
export class ProposalEvaluationModule {}
