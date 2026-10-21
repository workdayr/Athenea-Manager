import { Module } from '@nestjs/common';
import { MilestonesResolver } from './milestones.resolver.js';

@Module({
  providers: [MilestonesResolver],
})
export class MilestonesModule {}
