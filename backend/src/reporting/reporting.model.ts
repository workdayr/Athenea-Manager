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
import { ProjectStatusGql } from '../projects/projects.model.js';

/** RF-006: semaforo de cumplimiento del hito actual de un proyecto. */
export enum SlaStatusGql {
  on_track = 'on_track',
  at_risk = 'at_risk',
  upcoming = 'upcoming',
  no_milestones = 'no_milestones',
}

registerEnumType(SlaStatusGql, { name: 'SlaStatus' });

@InputType()
export class ReportFiltersInput {
  /** RF-008: por defecto se usa el ano en curso. */
  @Field(() => Int, { nullable: true })
  year?: number;

  @Field(() => GraphQLISODateTime, { nullable: true })
  from?: Date;

  @Field(() => GraphQLISODateTime, { nullable: true })
  to?: Date;

  /** Filtro de la tabla; los KPIs conservan el universo del periodo. */
  @Field(() => [ProjectStatusGql], { nullable: true })
  statuses?: ProjectStatusGql[];

  @Field(() => Int, { nullable: true })
  callId?: number;

  /** RF-012: busqueda parcial por titulo o nombre del PI. */
  @Field(() => String, { nullable: true })
  search?: string;

  @Field(() => Int, { nullable: true })
  page?: number;

  @Field(() => Int, { nullable: true })
  pageSize?: number;
}

@ObjectType()
export class DateRangeGql {
  @Field(() => GraphQLISODateTime)
  from!: Date;

  @Field(() => GraphQLISODateTime)
  to!: Date;
}

@ObjectType()
export class StatusCountGql {
  @Field(() => ProjectStatusGql)
  status!: ProjectStatusGql;

  @Field(() => Int)
  count!: number;
}

@ObjectType()
export class BudgetMetricsGql {
  /** null para roles sin acceso presupuestal (p. ej. Comite). */
  @Field(() => Float, { nullable: true })
  spent!: number | null;

  @Field(() => Int, { nullable: true })
  expenseCount!: number | null;

  @Field(() => Int)
  budgetEnabledProjects!: number;
}

@ObjectType()
export class ProductivityMetricsGql {
  @Field(() => Int)
  milestonesTotal!: number;

  @Field(() => Int)
  milestonesCompleted!: number;

  @Field(() => Int)
  milestonesDelayed!: number;

  /** Porcentaje 0-100 de hitos completados. */
  @Field(() => Float)
  completionRate!: number;

  @Field(() => Int)
  researchProducts!: number;

  @Field(() => Int)
  activeResearchers!: number;

  @Field(() => Float)
  productsPerActiveProject!: number;
}

@ObjectType()
export class DecisionMetricsGql {
  @Field(() => Int)
  total!: number;

  @Field(() => Int)
  approved!: number;

  @Field(() => Int)
  rejected!: number;

  @Field(() => Int)
  revisionRequested!: number;

  /** Porcentaje 0-100 de dictamenes aprobados sobre el total emitido. */
  @Field(() => Float)
  approvalRate!: number;
}

@ObjectType()
export class DashboardMetricsGql {
  @Field(() => Int)
  totalProjects!: number;

  @Field(() => [StatusCountGql])
  statusCounts!: StatusCountGql[];

  @Field(() => Int)
  activeProjects!: number;

  @Field(() => Int)
  completedProjects!: number;

  @Field(() => Int)
  delayedProjects!: number;

  @Field(() => BudgetMetricsGql)
  budget!: BudgetMetricsGql;

  @Field(() => ProductivityMetricsGql)
  productivity!: ProductivityMetricsGql;

  @Field(() => DecisionMetricsGql)
  decisions!: DecisionMetricsGql;
}

@ObjectType()
export class CallOptionGql {
  @Field(() => ID)
  callId!: number;

  @Field()
  title!: string;
}

@ObjectType()
export class DashboardProjectGql {
  @Field(() => ID)
  projectId!: number;

  @Field()
  title!: string;

  @Field(() => ProjectStatusGql)
  status!: ProjectStatusGql;

  @Field(() => String, { nullable: true })
  piName!: string | null;

  @Field(() => String, { nullable: true })
  callTitle!: string | null;

  @Field(() => GraphQLISODateTime)
  startDate!: Date;

  @Field(() => GraphQLISODateTime)
  endDate!: Date;

  @Field(() => String, { nullable: true })
  currentMilestone!: string | null;

  @Field(() => GraphQLISODateTime, { nullable: true })
  currentMilestoneDueDate!: Date | null;

  @Field(() => SlaStatusGql)
  slaStatus!: SlaStatusGql;

  @Field(() => Int, { nullable: true })
  daysLate!: number | null;
}

@ObjectType()
export class CoordinatorDashboardGql {
  @Field(() => DashboardMetricsGql)
  metrics!: DashboardMetricsGql;

  @Field(() => [DashboardProjectGql])
  projects!: DashboardProjectGql[];

  @Field(() => [CallOptionGql])
  callOptions!: CallOptionGql[];

  @Field(() => Int)
  totalFilteredProjects!: number;

  @Field(() => Int)
  page!: number;

  @Field(() => Int)
  pageSize!: number;

  @Field(() => Int)
  totalPages!: number;

  @Field(() => DateRangeGql)
  range!: DateRangeGql;

  @Field(() => GraphQLISODateTime)
  generatedAt!: Date;

  @Field(() => GraphQLISODateTime)
  cacheExpiresAt!: Date;

  @Field()
  fromCache!: boolean;

  /** Tiempo de calculo del servidor; 0 si todo vino de cache. */
  @Field(() => Float)
  computationMs!: number;
}

@ObjectType()
export class StatisticalReportGql {
  @Field(() => DashboardMetricsGql)
  metrics!: DashboardMetricsGql;

  @Field(() => DateRangeGql)
  range!: DateRangeGql;

  @Field(() => GraphQLISODateTime)
  generatedAt!: Date;

  @Field(() => GraphQLISODateTime)
  cacheExpiresAt!: Date;

  @Field()
  fromCache!: boolean;

  @Field(() => Float)
  computationMs!: number;
}
