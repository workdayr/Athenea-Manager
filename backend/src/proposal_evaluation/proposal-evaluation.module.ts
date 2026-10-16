import { Module } from '@nestjs/common';
import { ProposalEvaluationResolver } from './proposal-evaluation.resolver.js';

@Module({
  providers: [ProposalEvaluationResolver],
})
export class ProposalEvaluationModule {}
