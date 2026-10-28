import { Module } from '@nestjs/common';
import { ReportingResolver } from './reporting.resolver.js';
import { ReportingService } from './reporting.service.js';

@Module({
  providers: [ReportingService, ReportingResolver],
})
export class ReportingModule {}
