import { Module } from '@nestjs/common';
import { SearchResolver } from './search.resolver.js';
import { SearchService } from './search.service.js';

@Module({
  providers: [SearchService, SearchResolver],
})
export class SearchModule {}
