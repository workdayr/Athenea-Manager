import { UseGuards } from '@nestjs/common';
import { Args, Int, Query, Resolver } from '@nestjs/graphql';
import { RolesGuard } from '../auth/roles.guard.js';
import { PageInfoGql } from '../common/pagination/pagination.model.js';
import { toPageInfoGql } from '../common/pagination/pagination.policy.js';
import { CurrentUser } from '../projects/current-user.decorator.js';
import {
  SessionGuard,
  type AuthenticatedUser,
} from '../projects/session.guard.js';
import type { SearchTypeValue } from './search.constants.js';
import { SearchPageGql, SearchResultGql, SearchTypeGql } from './search.model.js';
import { SearchService } from './search.service.js';

/**
 * F2-01 / RF-012: busqueda interna transversal.
 * Disponible para cualquier usuario autenticado; el servicio aplica BR-007
 * y restringe usuarios y borradores a administracion.
 */
@Resolver()
@UseGuards(SessionGuard, RolesGuard)
export class SearchResolver {
  constructor(private readonly searchService: SearchService) {}

  @Query(() => SearchPageGql)
  async search(
    @Args('query', { type: () => String }) query: string,
    @CurrentUser() user: AuthenticatedUser,
    @Args('types', { type: () => [SearchTypeGql], nullable: true })
    types?: SearchTypeGql[],
    @Args('page', { type: () => Int, nullable: true, defaultValue: 1 })
    page = 1,
    @Args('pageSize', { type: () => Int, nullable: true, defaultValue: 20 })
    pageSize = 20,
  ): Promise<SearchPageGql> {
    const result = await this.searchService.search(
      user,
      query,
      types as SearchTypeValue[] | undefined,
      page,
      pageSize,
    );

    const gql = new SearchPageGql();
    gql.items = result.items.map((item) => {
      const row = new SearchResultGql();
      row.type = item.type as SearchTypeGql;
      row.id = item.id;
      row.title = item.title;
      row.subtitle = item.subtitle;
      row.link = item.link;
      row.rank = item.rank;
      return row;
    });
    gql.total = result.total;
    gql.page = result.page;
    gql.pageSize = result.pageSize;
    gql.pageInfo = toPageInfoGql(result.pageInfo, new PageInfoGql());
    return gql;
  }
}
