import { Module } from '@nestjs/common';
import { TeamsResolver } from './teams.resolver.js';
import { TeamsService } from './teams.service.js';

@Module({
  providers: [TeamsService, TeamsResolver],
})
export class TeamsModule {}
