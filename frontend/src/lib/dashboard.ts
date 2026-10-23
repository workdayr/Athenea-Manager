import type { Route } from 'next';
import type { IconName } from '@/components/dashboard/icons';

/**
 * Modelo de datos y reglas de presentacion del dashboard (UC-009 / RF-008).
 *
 * Estado de la integracion: `myProjects` ya existe en GraphQL y alimenta la
 * identidad del proyecto; las secciones de tareas, documentos y metricas
 * agregadas aun no tienen endpoint, por lo que se alimentan con datos de
 * ejemplo marcados con `isDemo`. Al existir esos endpoints basta con
 * reemplazar los arreglos exportados al final del archivo.
 */

export type PlatformRole =
  | 'ADMINISTRATOR'
  | 'COORDINATOR'
  | 'COMMITTEE'
  | 'PRINCIPAL_INVESTIGATOR'
  | 'STUDENT';

export interface DashboardUser {
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
    roles: EVERYONE,
  },
  {
    id: 'convocatorias',
    label: 'Convocatorias Institucionales',
    subtitle: 'Ciclo de fondos y cupos',
    icon: 'calls',
    roles: EVERYONE,
  },
  {
    id: 'rag',
    label: 'Asistente Virtual RAG',
    subtitle: 'Consulta documental asistida',
    icon: 'ai',
    roles: EVERYONE,
  },
  {
    id: 'configuracion',
    label: 'Configuración y Auditoría',
    subtitle: 'Roles y bitácora del sistema',
    icon: 'config',
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

/** Embudo institucional: los conteos alimentan el tablero agregado. */
export function institutionalLifecycle(): LifecycleModel {
  const counts = [14, 8, 6, 22, 4];
  return {
    steps: LIFECYCLE_TEMPLATE.map((step, index) => ({
      ...step,
      count: counts[index],
    })),
    currentId: 4,
  };
}

/** Etapa del ciclo de vida segun el estado del proyecto (Prisma). */
export function phaseForStatus(status: string): number {
  switch (status) {
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
/* KPIs institucionales                                                       */
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

export const INSTITUTIONAL_KPIS: InstitutionalKpi[] = [
  {
    id: 'projects',
    label: 'Proyectos totales registrados',
    value: '48',
    caption: 'Del ciclo activo',
    icon: 'grid',
    delta: '+12% vs ciclo ant.',
    chips: [
      { label: '14', value: 'Propuestos' },
      { label: '8', value: 'En Revisión' },
      { label: '22', value: 'Activos' },
      { label: '4', value: 'Concluidos' },
    ],
    roles: ['ADMINISTRATOR', 'COORDINATOR', 'COMMITTEE'],
  },
  {
    id: 'approval',
    label: 'Tasa de aprobación de comité',
    value: '76.4%',
    caption: 'Dictamen emitido',
    icon: 'gauge',
    progress: {
      prefix: 'Promedio: 18',
      highlight: 'SLA',
      suffix: 'Objetivo: < 30 días',
      percent: 60,
    },
    roles: ['ADMINISTRATOR', 'COORDINATOR', 'COMMITTEE'],
  },
  {
    id: 'risk',
    label: 'Hitos y entregas en riesgo',
    value: '3',
    caption: 'Retraso Crítico',
    icon: 'alert',
    alert:
      'Alerta automatizada (Cron >7 días RF-006). Notificación enviada al PI.',
    roles: ['ADMINISTRATOR', 'COORDINATOR', 'COMMITTEE'],
  },
  {
    id: 'budget',
    label: 'Presupuesto global I+D',
    value: '$4,850,000',
    caption: 'MXN Asignados (2026)',
    icon: 'wallet',
    progress: {
      prefix: 'Ejercicio: $2,910,250',
      highlight: 'MXN',
      suffix: '59.9%',
      percent: 59.9,
    },
    roles: ['ADMINISTRATOR', 'COORDINATOR'],
  },
  {
    id: 'reviews',
    label: 'Dictámenes emitidos',
    value: '128',
    caption: 'En el ciclo activo',
    icon: 'stamp',
    chips: [
      { label: '86', value: 'Aprobados' },
      { label: '27', value: 'Con observaciones' },
      { label: '15', value: 'Rechazados' },
    ],
    roles: ['COMMITTEE'],
  },
];

export function visibleKpis(role: PlatformRole): InstitutionalKpi[] {
  return INSTITUTIONAL_KPIS.filter((kpi) => kpi.roles.includes(role));
}

/* -------------------------------------------------------------------------- */
/* Distribucion por departamento                                              */
/* -------------------------------------------------------------------------- */

export interface DepartmentShare {
  name: string;
  projects: number;
  share: number;
  barClassName: string;
}

export const DEPARTMENT_SHARES: DepartmentShare[] = [
  {
    name: 'Ingeniería de Software e Inteligencia Computacional',
    projects: 18,
    share: 37.5,
    barClassName: 'bg-[#1e3a6e]',
  },
  {
    name: 'Biotecnología y Ciencias Genómicas',
    projects: 14,
    share: 29.2,
    barClassName: 'bg-[#2f7d8a]',
  },
  {
    name: 'Tecnologías Ambientales y Recursos Hídricos',
    projects: 9,
    share: 18.8,
    barClassName: 'bg-[#7c8aa5]',
  },
  {
    name: 'Mecatrónica y Sistemas Autónomos',
    projects: 7,
    share: 14.5,
    barClassName: 'bg-[#aab3c5]',
  },
];

/* -------------------------------------------------------------------------- */
/* Tabla de seguimiento de proyectos                                          */
/* -------------------------------------------------------------------------- */

export type SlaStatus = 'on_track' | 'at_risk' | 'upcoming';

export interface PriorityProject {
  id: string;
  title: string;
  call: string;
  pi: string;
  department: string;
  milestone: string;
  /** Fecha ISO del hito actual. */
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
};

export const PRIORITY_PROJECTS: PriorityProject[] = [
  {
    id: 'UPD-2024-001',
    title:
      'Optimización Algorítmica con IA para Redes de Distribución Energética',
    call: 'CONV-2024-A · Trámite 2/4',
    pi: 'Dr. Martín Castillo',
    department: 'Ing. de Software',
    milestone: 'Validación de Modelo Simulado',
    dueDate: '2026-11-15',
    sla: 'on_track',
    projectStatus: 'Active',
  },
  {
    id: 'UPD-2024-009',
    title: 'Bio-remediación en Aguas Residuales con Microalgas Nativas',
    call: 'CONAHYT Frontera · Dictamen Ético: Aprobado',
    pi: 'Dra. Silvia Lomelí',
    department: 'Tec. Ambientales',
    milestone: 'Informe Técnico Trimestral II',
    dueDate: '2026-10-11',
    sla: 'at_risk',
    projectStatus: 'Active',
    daysLate: 9,
  },
  {
    id: 'UPD-2024-015',
    title:
      'Sistema Distribuido para Trazabilidad Agrícola mediante Sensores IoT',
    call: 'Vinculación Industrial Agro · Tranche 1/3',
    pi: 'Mtro. Rodrigo Arias',
    department: 'Mecatrónica',
    milestone: 'Despliegue de Gateway en Invernadero',
    dueDate: '2026-10-28',
    sla: 'upcoming',
    projectStatus: 'Active',
  },
  {
    id: 'UPD-2024-022',
    title: 'Secuenciación y Mapeo Genético de Cepas Fúngicas Endémicas',
    call: 'CONV-2024-A · Protocolo de Bioseguridad BSL-2',
    pi: 'Dra. Claudia Paredes',
    department: 'Biotecnología',
    milestone: 'Aislamiento de Células y PCR',
    dueDate: '2026-12-05',
    sla: 'on_track',
    projectStatus: 'Active',
  },
  {
    id: 'UPD-2024-031',
    title: 'Exoesqueleto Robótico Asistivo para Rehabilitación Neuromotora',
    call: 'Salud y Dispositivos Médicos · Fase Clínica 1',
    pi: 'Dr. Héctor Navarrete',
    department: 'Mecatrónica',
    milestone: 'Protocolo de Consentimiento Informado',
    dueDate: '2026-11-22',
    sla: 'on_track',
    projectStatus: 'Active',
  },
  {
    id: 'UPD-2024-018',
    title: 'Modelo Predictivo de Demanda Eléctrica para Microrredes',
    call: 'CONV-2025-B · Radicación',
    pi: 'Dra. Ana Fuentes',
    department: 'Ing. de Software',
    milestone: 'Validación de requisitos de elegibilidad',
    dueDate: '2026-11-30',
    sla: 'upcoming',
    projectStatus: 'Proposed',
  },
  {
    id: 'UPD-2024-027',
    title: 'Plataforma de Analítica para Trayectorias Escolares',
    call: 'CONV-2025-B · Doble ciego',
    pi: 'Mtro. Luis Trejo',
    department: 'Ing. de Software',
    milestone: 'Revisión por pares en curso',
    dueDate: '2026-12-10',
    sla: 'on_track',
    projectStatus: 'Under_Review',
  },
  {
    id: 'UPD-2024-004',
    title: 'Caracterización de Suelos Agrícolas con Sensores Espectrales',
    call: 'CONAHYT · Cierre de ciclo',
    pi: 'Dra. Paula Serrano',
    department: 'Tec. Ambientales',
    milestone: 'Cierre de informe técnico',
    dueDate: '2026-09-30',
    sla: 'on_track',
    projectStatus: 'Completed',
  },
  {
    id: 'UPD-2024-036',
    title: 'Gemelo Digital para Mantenimiento Predictivo de Turbinas',
    call: 'Vinculación Industrial Agro · Tranche 2/3',
    pi: 'Dr. Óscar Beltrán',
    department: 'Mecatrónica',
    milestone: 'Calibración del gemelo digital',
    dueDate: '2026-10-31',
    sla: 'upcoming',
    projectStatus: 'Approved',
  },
  {
    id: 'UPD-2024-041',
    title: 'Nanomateriales para Captura de CO₂ en Procesos Industriales',
    call: 'CONV-2025-B · Radicación',
    pi: 'Dra. Renata Ibarra',
    department: 'Biotecnología',
    milestone: 'Síntesis de prototipo inicial',
    dueDate: '2026-12-18',
    sla: 'on_track',
    projectStatus: 'Proposed',
  },
];

/**
 * RF-001: el Comité solo consulta propuestas en dictamen; coordinacion y
 * administracion ven el inventario completo.
 */
export function visiblePriorityProjects(
  role: PlatformRole,
): PriorityProject[] {
  if (role === 'COMMITTEE') {
    return PRIORITY_PROJECTS.filter(
      (project) =>
        project.projectStatus === 'Proposed' ||
        project.projectStatus === 'Under_Review',
    );
  }
  return PRIORITY_PROJECTS;
}

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
  phase: string;
  dueDate: string;
  priority: 'Alta' | 'Media' | 'Baja';
  status: TaskStatus;
  /** `me` = usuario activo; `team` = otro miembro del equipo. */
  assignee: 'me' | 'team';
  assigneeName?: string;
}

export interface DashboardDocument {
  id: string;
  name: string;
  type: string;
  size: string;
  uploadedAt: string;
  visibility: 'Team_only' | 'Shared_with_administration';
  status: 'Aprobado' | 'En revisión' | 'Vigente';
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
  department: string;
  period: string;
  call: string;
  status: string;
  /** Avance calculado 0-100. */
  progress: number;
  budget: { assigned: number; spent: number };
  team: { name: string; role: string }[];
  isDemoIdentity: boolean;
}

export const DEMO_PROJECT: ProjectView = {
  id: 'UPD-2024-001',
  title:
    'Optimización Algorítmica con IA para Redes de Distribución Energética',
  description:
    'Diseño y validación de un motor de optimización basado en aprendizaje profundo para la planeación operativa de redes de distribución eléctrica, con énfasis en reducción de pérdidas técnicas y resiliencia ante demanda pico.',
  objectives: [
    'Reducir en al menos 12% las pérdidas técnicas de la red piloto mediante despacho optimizado.',
    'Desarrollar un modelo predictivo de demanda con error absoluto medio inferior al 4%.',
    'Documentar la arquitectura reproducible del sistema y transferirla al área de Operaciones.',
    'Publicar un artículo arbitrado y registrar el software ante la Vicerrectoría de I+D+I.',
  ],
  pi: 'Dr. Martín Castillo',
  department: 'Ingeniería de Software',
  period: 'Ene 2026 – Dic 2027',
  call: 'CONV-2024-A · Trámite 2/4',
  status: 'Active',
  progress: 62,
  budget: { assigned: 1_250_000, spent: 742_500 },
  team: [
    { name: 'Dr. Martín Castillo', role: 'Investigador Principal' },
    { name: 'Dra. Lucía Ramírez', role: 'Co-Investigadora' },
    { name: 'Ing. Diego Salas', role: 'Asistente de investigación' },
  ],
  isDemoIdentity: true,
};

export const PROJECT_TASKS: DashboardTask[] = [
  {
    id: 'T-101',
    title: 'Protocolo metodológico v3 y dictamen ético',
    phase: 'Radicación',
    dueDate: '2026-10-12',
    priority: 'Alta',
    status: 'Completed',
    assignee: 'me',
  },
  {
    id: 'T-102',
    title: 'Recolección de datos históricos de demanda (2020-2025)',
    phase: 'Ejecución',
    dueDate: '2026-10-18',
    priority: 'Media',
    status: 'Completed',
    assignee: 'team',
    assigneeName: 'Ing. Diego Salas',
  },
  {
    id: 'T-103',
    title: 'Informe técnico trimestral I',
    phase: 'Ejecución',
    dueDate: '2026-10-20',
    priority: 'Alta',
    status: 'In_Progress',
    assignee: 'team',
    assigneeName: 'Dra. Lucía Ramírez',
  },
  {
    id: 'T-104',
    title: 'Validar modelo de simulación en red piloto',
    phase: 'Ejecución',
    dueDate: '2026-10-28',
    priority: 'Alta',
    status: 'In_Progress',
    assignee: 'me',
  },
  {
    id: 'T-105',
    title: 'Integrar capa de optimización con el SCADA',
    phase: 'Ejecución',
    dueDate: '2026-11-04',
    priority: 'Media',
    status: 'Pending',
    assignee: 'me',
  },
  {
    id: 'T-106',
    title: 'Entrenamiento del modelo con datos 2024-2025',
    phase: 'Ejecución',
    dueDate: '2026-11-15',
    priority: 'Alta',
    status: 'Pending',
    assignee: 'team',
    assigneeName: 'Dra. Lucía Ramírez',
  },
  {
    id: 'T-107',
    title: 'Documentar API pública de simulación',
    phase: 'Transferencia',
    dueDate: '2026-12-02',
    priority: 'Baja',
    status: 'Pending',
    assignee: 'me',
  },
];

export const PROJECT_DOCUMENTS: DashboardDocument[] = [
  {
    id: 'DOC-301',
    name: 'Protocolo_Metodologico_v3.pdf',
    type: 'Metodología',
    size: '2.4 MB',
    uploadedAt: '2026-10-12',
    visibility: 'Shared_with_administration',
    status: 'Aprobado',
  },
  {
    id: 'DOC-302',
    name: 'Informe_Tecnico_Trimestral_I.pdf',
    type: 'Resultados',
    size: '5.1 MB',
    uploadedAt: '2026-10-08',
    visibility: 'Shared_with_administration',
    status: 'En revisión',
  },
  {
    id: 'DOC-303',
    name: 'Evidencia_Simulacion_RedPiloto.zip',
    type: 'Evidencia',
    size: '18.7 MB',
    uploadedAt: '2026-09-28',
    visibility: 'Team_only',
    status: 'Vigente',
  },
  {
    id: 'DOC-304',
    name: 'Convenio_Fondos_2026.pdf',
    type: 'Justificación',
    size: '1.2 MB',
    uploadedAt: '2026-10-02',
    visibility: 'Team_only',
    status: 'Vigente',
    piOnly: true,
  },
  {
    id: 'DOC-305',
    name: 'Abstract_Congreso_ENERGIA2026.pdf',
    type: 'Resumen',
    size: '480 KB',
    uploadedAt: '2026-09-21',
    visibility: 'Shared_with_administration',
    status: 'Aprobado',
  },
  {
    id: 'DOC-306',
    name: 'Aprobacion_Comite_Etico.pdf',
    type: 'Ética',
    size: '320 KB',
    uploadedAt: '2026-09-15',
    visibility: 'Shared_with_administration',
    status: 'Aprobado',
  },
];

/**
 * RF-001 / RF-005: el estudiante solo ve las tareas que tiene asignadas y
 * los documentos del equipo; los expedientes reservados son del PI.
 */
export function visibleTasks(
  role: PlatformRole,
  tasks: DashboardTask[],
): DashboardTask[] {
  if (role === 'PRINCIPAL_INVESTIGATOR') {
    return tasks;
  }
  return tasks.filter((task) => task.assignee === 'me');
}

export function visibleDocuments(
  role: PlatformRole,
  documents: DashboardDocument[],
): DashboardDocument[] {
  if (role === 'PRINCIPAL_INVESTIGATOR') {
    return documents;
  }
  return documents.filter((document) => !document.piOnly);
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
