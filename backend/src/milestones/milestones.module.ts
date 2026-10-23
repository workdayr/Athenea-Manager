import { Module } from '@nestjs/common';
import { MilestonesController } from './milestones.controller.js';
import { MilestonesResolver } from './milestones.resolver.js';
import { MilestonesService } from './milestones.service.js';

@Module({
  controllers: [MilestonesController],
  providers: [MilestonesService, MilestonesResolver],
})
export class MilestonesModule {}