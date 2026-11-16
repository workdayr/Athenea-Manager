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

  /** RF-020: proyecto archivado; toda escritura queda bloqueada. */
  @Field()
  isReadOnly!: boolean;

  /** RF-020: fecha en que se congelo el expediente. */
  @Field(() => GraphQLISODateTime, { nullable: true })
  archivedAt!: Date | null;

  /** BR-007: proyecto confidencial (solo equipo y administradores). */
  @Field()
  isConfidential!: boolean;

  /** BR-006: banderas de investigacion sensible declaradas en el alta. */
  @Field()
  researchInvolvesHumans!: boolean;

  @Field()
  researchInvolvesAnimals!: boolean;

  @Field()
  usesSensitiveData!: boolean;

  /** BR-012: certificacion de anonimizacion a nivel de proyecto. */
  @Field()
  anonymizationCertified!: boolean;

  @Field(() => GraphQLISODateTime, { nullable: true })
  anonymizationCertifiedAt!: Date | null;

  /** BR-013: fechas de retencion y borrado seguro. */
  @Field(() => GraphQLISODateTime, { nullable: true })
  retentionDeleteAt!: Date | null;

  @Field(() => GraphQLISODateTime, { nullable: true })
  retentionNotifiedAt!: Date | null;

  @Field(() => GraphQLISODateTime, { nullable: true })
  retentionDeletedAt!: Date | null;

  /** F1-02: fecha del ultimo cambio de estado. */
  @Field(() => GraphQLISODateTime)
  statusChangedAt!: Date;
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

  /** BR-006: banderas de investigacion sensible. */
  @Field(() => Boolean, { nullable: true })
  researchInvolvesHumans?: boolean;

  @Field(() => Boolean, { nullable: true })
  researchInvolvesAnimals?: boolean;

  @Field(() => Boolean, { nullable: true })
  usesSensitiveData?: boolean;

  /** BR-007: proyecto confidencial. */
  @Field(() => Boolean, { nullable: true })
  isConfidential?: boolean;
}

@InputType()
export class UpdateProjectSettingsInput {
  @Field(() => Boolean, { nullable: true })
  isConfidential?: boolean;

  @Field(() => Boolean, { nullable: true })
  researchInvolvesHumans?: boolean;

  @Field(() => Boolean, { nullable: true })
  researchInvolvesAnimals?: boolean;

  @Field(() => Boolean, { nullable: true })
  usesSensitiveData?: boolean;
}
