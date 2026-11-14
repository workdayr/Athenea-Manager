import { Module } from '@nestjs/common';
import { ReportingExportController } from './reporting-export.controller.js';
import { ReportingResolver } from './reporting.resolver.js';
import { ReportingService } from './reporting.service.js';

@Module({
  controllers: [ReportingExportController],
  providers: [ReportingService, ReportingResolver],
})
export class ReportingModule {}
