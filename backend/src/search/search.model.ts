import {
  Field,
  Float,
  ID,
  Int,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import { PageInfoGql } from '../common/pagination/pagination.model.js';

/** F2-01 / RF-012: entidades cubiertas por la busqueda interna. */
export enum SearchTypeGql {
  PROJECT = 'PROJECT',
  CALL = 'CALL',
  USER = 'USER',
}

registerEnumType(SearchTypeGql, { name: 'SearchType' });

@ObjectType()
export class SearchResultGql {
  @Field(() => SearchTypeGql)
  type!: SearchTypeGql;

  @Field(() => ID)
  id!: string;

  @Field()
  title!: string;

  @Field(() => String, { nullable: true })
  subtitle!: string | null;

  @Field(() => String, { nullable: true })
  link!: string | null;

  @Field(() => Float)
  rank!: number;
}

@ObjectType()
export class SearchPageGql {
  @Field(() => [SearchResultGql])
  items!: SearchResultGql[];

  @Field(() => Int)
  total!: number;

  @Field(() => Int)
  page!: number;

  @Field(() => Int)
  pageSize!: number;

  @Field(() => PageInfoGql)
  pageInfo!: PageInfoGql;
}
