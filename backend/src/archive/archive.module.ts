import { Module } from '@nestjs/common';
import { ArchiveResolver } from './archive.resolver.js';
import { ProjectArchiveScheduler } from './archive.scheduler.js';
import { ProjectArchiveService } from './archive.service.js';

/**
 * RF-020: archivo institucional inmutable de proyectos cerrados.
 *
 * El servicio y el scheduler son independientes del flujo de versiones de
 * propuesta (RF-004) para no acoplarse con ese modulo.
 */
@Module({
  providers: [
    ProjectArchiveService,
    ProjectArchiveScheduler,
    ArchiveResolver,
  ],
})
export class ArchiveModule {}
