import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller.js';
import { ProjectEthicsResolver } from './project-ethics.resolver.js';
import { ProjectRetentionScheduler } from './project-ethics.scheduler.js';
import { ProjectEthicsService } from './project-ethics.service.js';
import { ProjectLifecycleResolver } from './project-lifecycle.resolver.js';
import { ProjectSlaScheduler } from './project-lifecycle.scheduler.js';
import { ProjectLifecycleService } from './project-lifecycle.service.js';
import { ProjectsResolver } from './projects.resolver.js';

@Module({
  controllers: [DocumentsController],
  providers: [
    ProjectsResolver,
    ProjectLifecycleService,
    ProjectLifecycleResolver,
    ProjectSlaScheduler,
    ProjectEthicsService,
    ProjectEthicsResolver,
    ProjectRetentionScheduler,
  ],
})
export class ProjectsModule {}
