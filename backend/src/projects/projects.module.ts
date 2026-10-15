import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller.js';
import { ProjectsResolver } from './projects.resolver.js';

@Module({
  controllers: [DocumentsController],
  providers: [ProjectsResolver],
})
export class ProjectsModule {}
