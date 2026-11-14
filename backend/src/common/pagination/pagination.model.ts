import {
  Field,
  InputType,
  Int,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';

/**
 * F2-03 / RF-013: tipos reutilizables de paginacion y ordenamiento.
 * Los servicios normalizan la entrada con `pagination.policy.ts` y nunca
 * devuelven mas de `PAGINATION_MAX_PAGE_SIZE` registros.
 */

export enum SortDirectionGql {
  ASC = 'asc',
  DESC = 'desc',
}

registerEnumType(SortDirectionGql, { name: 'SortDirection' });

@InputType()
export class PageInput {
  /** Numero de pagina, 1-based. */
  @Field(() => Int, { nullable: true })
  page?: number;

  /** Registros por pagina (maximo 50, RF-013). */
  @Field(() => Int, { nullable: true })
  pageSize?: number;

  /** Campo de ordenamiento validado por cada listado. */
  @Field(() => String, { nullable: true })
  sortBy?: string;

  @Field(() => SortDirectionGql, { nullable: true })
  sortDir?: SortDirectionGql;
}

@ObjectType()
export class PageInfoGql {
  @Field(() => Int)
  page!: number;

  @Field(() => Int)
  pageSize!: number;

  @Field(() => Int)
  total!: number;

  @Field(() => Int)
  totalPages!: number;

  @Field()
  hasNextPage!: boolean;

  @Field()
  hasPreviousPage!: boolean;
}
