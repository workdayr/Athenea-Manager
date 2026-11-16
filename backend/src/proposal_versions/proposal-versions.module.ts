import { Module } from '@nestjs/common';
import { ProposalVersionsController } from './proposal-versions.controller.js';
import { ProposalVersionsResolver } from './proposal-versions.resolver.js';

@Module({
  controllers: [ProposalVersionsController],
  providers: [ProposalVersionsResolver],
  exports: [],
})
export class ProposalVersionsModule {}
