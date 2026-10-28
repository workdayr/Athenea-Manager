import {
  Field,
  Float,
  ID,
  InputType,
  Int,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import { GraphQLISODateTime } from '@nestjs/graphql';

export enum ProjectStatusGql {
  Draft = 'Draft',
  Proposed = 'Proposed',
  Under_Review = 'Under_Review',
  Approved = 'Approved',
  Active = 'Active',
  Completed = 'Completed',
  Closed = 'Closed',
  Rejected = 'Rejected',
  Suspended = 'Suspended',
}

registerEnumType(ProjectStatusGql, { name: 'ProjectStatus' });

@ObjectType()
export class ProjectTeamMemberGql {
  @Field()
  name!: string;

  /** Valor del enum `ProjectRole` de Prisma (p. ej. Principal_Investigator). */
  @Field()
  role!: string;
}

@ObjectType()
export class ProjectGql {
  @Field(() => ID)
  projectId!: number;

  @Field()
  title!: string;

  @Field()
  objectives!: string;

  @Field(() => GraphQLISODateTime)
  startDate!: Date;

  @Field(() => GraphQLISODateTime)
  endDate!: Date;

  @Field(() => ProjectStatusGql)
  status!: ProjectStatusGql;

  @Field(() => Int, { nullable: true })
  callId!: number | null;

  /** Nombre del investigador principal registrado en el proyecto. */
  @Field(() => String, { nullable: true })
  piName!: string | null;

  /** Titulo real de la convocatoria asociada. */
  @Field(() => String, { nullable: true })
  callTitle!: string | null;

  @Field(() => [ProjectTeamMemberGql])
  team!: ProjectTeamMemberGql[];

  @Field(() => Int)
  milestonesTotal!: number;

  @Field(() => Int)
  milestonesCompleted!: number;

  @Field()
  budgetEnabled!: boolean;

  /** Gasto real del proyecto; null para roles sin acceso presupuestal. */
  @Field(() => Float, { nullable: true })
  budgetSpent!: number | null;
}

@InputType()
export class RegisterProjectInput {
  @Field()
  title!: string;

  @Field()
  objectives!: string;

  @Field(() => GraphQLISODateTime)
  startDate!: Date;

  @Field(() => GraphQLISODateTime)
  endDate!: Date;

  @Field(() => Int, { nullable: true })
  callId?: number | null;
}
