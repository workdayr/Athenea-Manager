import type { Route } from 'next';
import type { IconName } from '@/components/dashboard/icons';

/**
 * Modelo de datos y reglas de presentacion del dashboard (UC-009 / RF-008).
 *
 * El tablero institucional (RF-008) consume `coordinatorDashboard` mediante
 * `@/lib/reporting`; este archivo conserva los tipos, etiquetas y utilidades
 * compartidas. La vista de proyecto consume `myProjects` y muestra estados
 * vacios cuando el usuario no tiene proyectos, sin datos de ejemplo.
 */

export type PlatformRole =
  | 'ADMINISTRATOR'
  | 'COORDINATOR'
  | 'COMMITTEE'
  | 'PRINCIPAL_INVESTIGATOR'
  | 'STUDENT';

export interface DashboardUser {
  id: string;
  name: string;
  email: string;
  role: PlatformRole;
}

export const ROLE_LABELS: Record<PlatformRole, string> = {
  ADMINISTRATOR: 'Administrador',
  COORDINATOR: 'Coordinador / Evaluador',
  COMMITTEE: 'Comité de Evaluación',
  PRINCIPAL_INVESTIGATOR: 'Investigador Principal',
  STUDENT: 'Miembro del Equipo',
};

/** Roles cuya vista principal es institucional (no de un proyecto propio). */
export const INSTITUTIONAL_ROLES: PlatformRole[] = [
  'ADMINISTRATOR',
  'COORDINATOR',
  'COMMITTEE',
];

export function isInstitutionalRole(role: PlatformRole): boolean {
  return INSTITUTIONAL_ROLES.includes(role);
}

/** Normaliza el rol que llega de la sesion; sin rol => minimo privilegio. */
export function toPlatformRole(value: unknown): PlatformRole {
  const roles: PlatformRole[] = [
    'ADMINISTRATOR',
    'COORDINATOR',
    'COMMITTEE',
    'PRINCIPAL_INVESTIGATOR',
    'STUDENT',
  ];
  return roles.find((role) => role === value) ?? 'STUDENT';
}

/* -------------------------------------------------------------------------- */
/* Navegacion (RF-001: cada rol ve solo los modulos permitidos)               */
/* -------------------------------------------------------------------------- */

export interface NavItem {
  id: string;
  label: string;
  subtitle: string;
  icon: IconName;
  roles: PlatformRole[];
  /** Sin `href` el modulo aun no existe: se muestra, pero no navega. */
  href?: Route;
  /** Sub-entrada compacta (p. ej. alertas de conflicto bajo dictamenes). */
  compact?: boolean;
}

const EVERYONE: PlatformRole[] = [
  'ADMINISTRATOR',
  'COORDINATOR',
  'COMMITTEE',
  'PRINCIPAL_INVESTIGATOR',
  'STUDENT',
];

export const NAV_ITEMS: NavItem[] = [
  {
    id: 'panel',
    label: 'Panel Principal',
    subtitle: 'Control institucional',
    icon: 'dashboard',
    href: '/dashboard',
    roles: EVERYONE,
  },
  {
    id: 'registro',
    label: 'Registro de Proyectos',
    subtitle: 'Nueva propuesta de investigación',
    icon: 'register',
    href: '/projects/new',
    roles: ['PRINCIPAL_INVESTIGATOR'],
  },
  {
    id: 'evaluacion',
    label: 'Evaluación de Dictámenes',
    subtitle: 'Propuestas pendientes de revisión',
    icon: 'evaluation',
    href: '/proposal-evaluation',
    roles: ['COMMITTEE', 'COORDINATOR'],
  },
  {
    id: 'conflictos',
    label: 'Alertas de Conflicto',
    subtitle: 'Revisión BR-011',
    icon: 'alert',
    href: '/proposal-evaluation/conflicts',
    roles: ['ADMINISTRATOR'],
    compact: true,
  },
  {
    id: 'hitos',
    label: 'Proyectos Activos e Hitos',
    subtitle: 'Seguimiento de entregables',
    icon: 'milestones',
    href: '/projects',
    roles: EVERYONE,
  },
  {
    id: 'convocatorias',
    label: 'Convocatorias Institucionales',
    subtitle: 'Ciclo de fondos y cupos',
    icon: 'calls',
    href: '/calls',
    roles: EVERYONE,
  },
  {
    id: 'usuarios',
    label: 'Usuarios y Roles',
    subtitle: 'Administración de cuentas RF-001',
    icon: 'users',
    href: '/admin/users',
    roles: ['ADMINISTRATOR'],
  },
  {
    id: 'rag',
    label: 'Asistente Virtual RAG',
    subtitle: 'Consulta documental asistida',
    icon: 'ai',
    href: '/assistant',
    roles: EVERYONE,
  },
  {
    id: 'configuracion',
    label: 'Configuración y Auditoría',
    subtitle: 'Roles y bitácora del sistema',
    icon: 'config',
    href: '/admin/audit',
    roles: ['ADMINISTRATOR', 'COORDINATOR'],
  },
];

export function navItemsForRole(role: PlatformRole): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}

export function sidebarTitleForRole(role: PlatformRole): string {
  return isInstitutionalRole(role)
    ? 'Administración y Dictamen'
    : 'Investigación y Seguimiento';
}

/* -------------------------------------------------------------------------- */
/* Ciclo de vida (RF-003, RF-006, RF-007)                                     */
/* -------------------------------------------------------------------------- */

export type LifecycleState = 'done' | 'current' | 'upcoming';

export interface LifecycleStep {
  id: number;
  name: string;
  description: string;
  /** Conteo institucional de proyectos en la etapa. */
  count?: number;
  /** Estado cuando el embudo representa un proyecto concreto. */
  state?: LifecycleState;
}

export interface LifecycleModel {
  steps: LifecycleStep[];
  currentId: number;
}

const LIFECYCLE_TEMPLATE = [
  {
    id: 1,
    name: 'Propuesto / Radicación',
    description: 'Revisión de requisitos de elegibilidad',
  },
  {
    id: 2,
    name: 'En Revisión por Pares',
    description: 'Doble ciego y Comité Ético Institucional',
  },
  {
    id: 3,
    name: 'Dictaminado Aprobado',
    description: 'En proceso de firma de convenio de fondos',
  },
  {
    id: 4,
    name: 'En Ejecución / Activo',
    description: 'Entregas periódicas e hitos de avance',
  },
  {
    id: 5,
    name: 'Concluido / Transferencia',
    description: 'Auditoría final y cierre de informe técnico',
  },
] as const;

/** Embudo institucional: los conteos provienen de `coordinatorDashboard`. */
export function institutionalLifecycle(
  counts: number[] = [0, 0, 0, 0, 0],
): LifecycleModel {
  return {
    steps: LIFECYCLE_TEMPLATE.map((step, index) => ({
      ...step,
      count: counts[index] ?? 0,
    })),
    currentId: 4,
  };
}

/** Etapa del ciclo de vida segun el estado del proyecto (Prisma). */
export function phaseForStatus(status: string): number {
  switch (status) {
    case 'Draft':
    case 'Proposed':
      return 1;
    case 'Under_Review':
      return 2;
    case 'Approved':
    case 'Rejected':
      return 3;
    case 'Active':
      return 4;
    case 'Completed':
    case 'Closed':
      return 5;
    case 'Suspended':
      return 4;
    default:
      return 1;
  }
}

/** Embudo de un proyecto: marca etapas cumplidas, actual y futuras. */
export function projectLifecycle(status: string): LifecycleModel {
  const currentId = phaseForStatus(status);
  return {
    currentId,
    steps: LIFECYCLE_TEMPLATE.map((step) => ({
      ...step,
      state:
        step.id < currentId
          ? 'done'
          : step.id === currentId
            ? 'current'
            : 'upcoming',
    })),
  };
}

export const STATUS_LABELS: Record<string, string> = {
  Draft: 'Borrador',
  Proposed: 'Propuesto',
  Under_Review: 'En revisión',
  Approved: 'Aprobado',
  Active: 'Activo',
  Completed: 'Concluido',
  Closed: 'Cerrado',
  Rejected: 'Rechazado',
  Suspended: 'Suspendido',
};

/* -------------------------------------------------------------------------- */
/* KPIs                                                                       */
/* -------------------------------------------------------------------------- */

export interface InstitutionalKpi {
  id: string;
  label: string;
  value: string;
  caption: string;
  icon: IconName;
  delta?: string;
  chips?: { label: string; value: string }[];
  progress?: {
    prefix: string;
    highlight: string;
    suffix?: string;
    percent: number;
  };
  alert?: string;
  /** RF-001: el KPI solo se renderiza para estos roles. */
  roles: PlatformRole[];
}

/* -------------------------------------------------------------------------- */
/* Tabla de seguimiento de proyectos                                          */
/* -------------------------------------------------------------------------- */

export type SlaStatus = 'on_track' | 'at_risk' | 'upcoming' | 'no_milestones';

export interface PriorityProject {
  /** Identificador visible (PRJ-0001). */
  id: string;
  /** Identificador numérico para enlazar al detalle. */
  projectId: string;
  title: string;
  call: string;
  pi: string;
  milestone: string;
  /** Fecha ISO del hito actual (o fin del proyecto si no hay hitos). */
  dueDate: string;
  sla: SlaStatus;
  projectStatus: string;
  /** Conteo de dias de retraso cuando `sla === 'at_risk'`. */
  daysLate?: number;
}

export const SLA_LABELS: Record<SlaStatus, string> = {
  on_track: 'Al día',
  at_risk: 'Retraso Crítico',
  upcoming: 'Próximo',
  no_milestones: 'Sin hitos',
};


/* -------------------------------------------------------------------------- */
/* Vista de proyecto (PI y miembros del equipo)                               */
/* -------------------------------------------------------------------------- */

export type TaskStatus = 'Pending' | 'In_Progress' | 'Completed';

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  Pending: 'Pendiente',
  In_Progress: 'En progreso',
  Completed: 'Completada',
};

export interface DashboardTask {
  id: string;
  title: string;
  dueDate: string;
  status: TaskStatus;
  /** `me` = usuario activo; `team` = otro miembro del equipo. */
  assignee: 'me' | 'team';
  assigneeName?: string;
}

export interface DashboardDocument {
  id: string;
  documentId?: number;
  name: string;
  type: string;
  size: string;
  uploadedAt: string;
  visibility: 'Team_only' | 'Shared_with_administration';
  /** Documentos reservados al PI y a la administración (RF-005). */
  piOnly?: boolean;
  /** US 4.1: protocolo o aprobación de ética (no puede ser privado). */
  mandatoryReview?: boolean;
  /** US 4.1: el usuario actual puede cambiar la visibilidad. */
  canChangeVisibility?: boolean;
}

export interface ProjectView {
  id: string;
  title: string;
  description: string;
  objectives: string[];
  pi: string;
  period: string;
  call: string;
  status: string;
  /** Avance calculado 0-100 a partir de hitos o del periodo. */
  progress: number;
  budget: { enabled: boolean; spent: number };
  team: { name: string; role: string }[];
}

export function countByStatus(tasks: DashboardTask[]) {
  return {
    Pending: tasks.filter((task) => task.status === 'Pending').length,
    In_Progress: tasks.filter((task) => task.status === 'In_Progress').length,
    Completed: tasks.filter((task) => task.status === 'Completed').length,
  };
}

/* -------------------------------------------------------------------------- */
/* Utilidades de formato                                                      */
/* -------------------------------------------------------------------------- */

const DATE_FORMATTER = new Intl.DateTimeFormat('es-MX', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

export function formatDate(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return DATE_FORMATTER.format(date);
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1).replace('.0', '')}%`;
}

/** Nombre corto sin honorificos (para "Tú (Martín)"). */
export function firstName(name: string): string {
  const cleaned = name
    .replace(/^(Dr|Dra|Mtro|Mtra|Ing|Lic)\.?\s+/i, '')
    .trim();
  return cleaned.split(/\s+/)[0] ?? cleaned;
}

export function initials(name: string): string {
  const parts = name
    .replace(/^(Dr|Dra|Mtro|Mtra|Ing|Lic)\.?\s+/i, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) {
    return '··';
  }
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return `${first}${last}`.toUpperCase();
}

export function daysUntil(value: string): number {
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) {
    return 0;
  }
  const today = new Date();
  const diff = target.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/** Avance del proyecto segun el periodo transcurrido. */
export function progressFromPeriod(startDate: string, endDate: string): number {
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
    return 0;
  }
  const now = Date.now();
  if (now <= start) {
    return 0;
  }
  if (now >= end) {
    return 100;
  }
  return Math.round(((now - start) / (end - start)) * 100);
}

export function shortPeriod(startDate: string, endDate: string): string {
  const formatter = new Intl.DateTimeFormat('es-MX', {
    month: 'short',
    year: 'numeric',
  });
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return '—';
  }
  return `${formatter.format(start)} – ${formatter.format(end)}`;
}
