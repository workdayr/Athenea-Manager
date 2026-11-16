import {
  Field,
  GraphQLISODateTime,
  Int,
  ObjectType,
} from '@nestjs/graphql';

/** BR-012: resultado de certificar la anonimizacion de un proyecto. */
@ObjectType()
export class AnonymizationCertificationGql {
  @Field(() => Int)
  projectId!: number;

  @Field()
  certified!: boolean;

  @Field(() => GraphQLISODateTime)
  certifiedAt!: Date;
}

/** BR-013: resumen del job de avisos y borrado seguro. */
@ObjectType()
export class RetentionBatchResultGql {
  @Field(() => Int)
  scanned!: number;

  @Field(() => Int)
  noticesSent!: number;

  @Field(() => Int)
  deleted!: number;

  @Field(() => Int)
  failed!: number;
}
