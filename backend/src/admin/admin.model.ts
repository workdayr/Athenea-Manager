import {
  Field,
  GraphQLISODateTime,
  ID,
  InputType,
  Int,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import { PageInfoGql } from '../common/pagination/pagination.model.js';

/** Roles de plataforma (RF-001); coincide con el enum `Role` de Prisma. */
export enum RoleGql {
  STUDENT = 'STUDENT',
  PRINCIPAL_INVESTIGATOR = 'PRINCIPAL_INVESTIGATOR',
  COORDINATOR = 'COORDINATOR',
  COMMITTEE = 'COMMITTEE',
  ADMINISTRATOR = 'ADMINISTRATOR',
}

registerEnumType(RoleGql, { name: 'Role' });

@InputType()
export class UserFiltersInput {
  @Field(() => RoleGql, { nullable: true })
  role?: RoleGql;

  @Field(() => String, { nullable: true })
  search?: string;

  @Field(() => Boolean, { nullable: true })
  emailVerified?: boolean;

  @Field(() => Boolean, { nullable: true })
  lockedOnly?: boolean;
}

@ObjectType()
export class AdminUserGql {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field()
  email!: string;

  @Field()
  emailVerified!: boolean;

  @Field(() => RoleGql)
  role!: RoleGql;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;

  /** Fin del bloqueo por intentos fallidos (RF-010). */
  @Field(() => GraphQLISODateTime, { nullable: true })
  lockedUntil!: Date | null;
}

@ObjectType()
export class AdminUserPageGql {
  @Field(() => [AdminUserGql])
  items!: AdminUserGql[];

  @Field(() => Int)
  total!: number;

  @Field(() => Int)
  page!: number;

  @Field(() => Int)
  pageSize!: number;

  /** F2-03 / RF-013: metadatos de paginacion reutilizables. */
  @Field(() => PageInfoGql)
  pageInfo!: PageInfoGql;
}
