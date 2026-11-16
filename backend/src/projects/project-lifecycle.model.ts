import {
  Field,
  GraphQLISODateTime,
  Int,
  ObjectType,
} from '@nestjs/graphql';
import { ProjectStatusGql } from './projects.model.js';

/** F1-02: fila del historial de estados. */
@ObjectType()
export class ProjectStatusTransitionGql {
  @Field(() => Int)
  transitionId!: number;

  @Field(() => Int)
  projectId!: number;

  @Field(() => ProjectStatusGql)
  fromStatus!: ProjectStatusGql;

  @Field(() => ProjectStatusGql)
  toStatus!: ProjectStatusGql;

  @Field(() => String, { nullable: true })
  justification!: string | null;

  @Field()
  actorName!: string;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;
}

/** F1-02: resultado de una transicion manual. */
@ObjectType()
export class ProjectTransitionResultGql {
  @Field(() => Int)
  projectId!: number;

  @Field(() => ProjectStatusGql)
  previousStatus!: ProjectStatusGql;

  @Field(() => ProjectStatusGql)
  newStatus!: ProjectStatusGql;

  @Field(() => Int)
  transitionId!: number;

  @Field(() => GraphQLISODateTime)
  changedAt!: Date;
}

/** F1-02: resumen del job de SLA de revision. */
@ObjectType()
export class ProjectSlaScanResultGql {
  @Field(() => Int)
  scanned!: number;

  @Field(() => Int)
  notified!: number;
}
