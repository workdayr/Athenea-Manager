import { UseGuards } from '@nestjs/common';
import {
  Args,
  Context,
  Int,
  Mutation,
  Query,
  Resolver,
} from '@nestjs/graphql';
import { GraphQLError } from 'graphql';
import { ROLES } from '../auth/roles.constants.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { SortDirectionGql } from '../common/pagination/pagination.model.js';
import { CurrentUser } from '../projects/current-user.decorator.js';
import { ProjectReadOnlyError } from '../projects/project-write-guard.js';
import {
  SessionGuard,
  type AuthenticatedUser,
} from '../projects/session.guard.js';
import {
  ProductAuthorGql,
  ProductTypeGql,
  RegisterResearchOutputInput,
  ResearchProductGql,
} from './products.model.js';
import {
  getProjectProducts,
  ProductError,
  ProductView,
  registerResearchOutput,
} from './products.service.js';

function toGraphQLError(error: unknown): never {
  if (
    error instanceof ProductError ||
    error instanceof ProjectReadOnlyError
  ) {
    throw new GraphQLError(error.message, {
      extensions: { code: error.code, field: error.field ?? null },
    });
  }
  throw error;
}

function toProductGql(view: ProductView): ResearchProductGql {
  const gql = new ResearchProductGql();
  gql.productId = view.productId;
  gql.projectId = view.projectId;
  gql.productType = view.productType as ProductTypeGql;
  gql.urlDoi = view.urlDoi;
  gql.title = view.title;
  gql.createdAt = view.createdAt;
  gql.authors = view.authors.map((a) => {
    const authorGql = new ProductAuthorGql();
    authorGql.userId = a.userId;
    authorGql.name = a.name;
    authorGql.email = a.email;
    authorGql.authorOrder = a.authorOrder;
    return authorGql;
  });
  return gql;
}

@Resolver(() => ResearchProductGql)
@UseGuards(SessionGuard, RolesGuard)
export class ProductsResolver {
  @Mutation(() => ResearchProductGql)
  @Roles(ROLES.PRINCIPAL_INVESTIGATOR)
  async registerResearchOutput(
    @Args('input') input: RegisterResearchOutputInput,
    @CurrentUser() user: AuthenticatedUser,
    @Context() context: { req?: { ip?: string } },
  ): Promise<ResearchProductGql> {
    try {
      const view = await registerResearchOutput(
        user,
        {
          projectId: input.projectId,
          productType: input.productType,
          urlDoi: input.urlDoi,
          title: input.title,
          authors: input.authors,
        },
        context.req?.ip ?? 'unknown',
      );
      return toProductGql(view);
    } catch (error) {
      toGraphQLError(error);
    }
  }

  @Query(() => [ResearchProductGql])
  async projectProducts(
    @Args('projectId', { type: () => Int }) projectId: number,
    @Args('page', { type: () => Int, nullable: true }) page?: number,
    @Args('pageSize', { type: () => Int, nullable: true }) pageSize?: number,
    @Args('sortBy', { type: () => String, nullable: true }) sortBy?: string,
    @Args('sortDir', { type: () => SortDirectionGql, nullable: true })
    sortDir?: SortDirectionGql,
  ): Promise<ResearchProductGql[]> {
    try {
      const views = await getProjectProducts(projectId, {
        page,
        pageSize,
        sortBy,
        sortDir,
      });
      return views.map(toProductGql);
    } catch (error) {
      toGraphQLError(error);
    }
  }
}
