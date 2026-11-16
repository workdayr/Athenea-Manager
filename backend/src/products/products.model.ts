import {
  Field,
  GraphQLISODateTime,
  ID,
  InputType,
  Int,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';

export enum ProductTypeGql {
  JOURNAL_ARTICLE = 'journal_article',
  CONFERENCE_PRESENTATION = 'conference_presentation',
  SOFTWARE = 'software',
  PATENT = 'patent',
  THESIS = 'thesis',
}

registerEnumType(ProductTypeGql, {
  name: 'ProductType',
  description: 'Tipo de producto de investigacion academica / cientifica.',
});

@ObjectType()
export class ProductAuthorGql {
  @Field(() => ID)
  userId!: string;

  @Field()
  name!: string;

  @Field()
  email!: string;

  @Field(() => Int)
  authorOrder!: number;
}

@ObjectType()
export class ResearchProductGql {
  @Field(() => ID)
  productId!: number;

  @Field(() => Int)
  projectId!: number;

  @Field(() => ProductTypeGql)
  productType!: ProductTypeGql;

  @Field()
  urlDoi!: string;

  @Field(() => String, { nullable: true })
  title!: string | null;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;

  @Field(() => [ProductAuthorGql])
  authors!: ProductAuthorGql[];
}

@InputType()
export class RegisterResearchOutputInput {
  @Field(() => Int)
  projectId!: number;

  @Field(() => ProductTypeGql)
  productType!: ProductTypeGql;

  @Field()
  urlDoi!: string;

  @Field(() => String, { nullable: true })
  title?: string | null;

  @Field(() => [ID])
  authors!: string[];
}
