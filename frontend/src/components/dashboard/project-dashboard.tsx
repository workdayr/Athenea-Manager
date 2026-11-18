'use client';

import { useEffect, useMemo, useState } from 'react';
//import { useQuery } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import { Alert } from '@/components/ui/alert';
import { Button, ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { PageHeader } from '@/components/ui/page-header';
import { ProgressBar } from '@/components/ui/progress';
import { Skeleton, SkeletonRows } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/components/ui/toast-provider';
import { Icon } from './icons';
import { KpiCard } from './kpi-card';
import { LifecycleFunnel } from './lifecycle-funnel';
import {
  ROLE_LABELS,
  STATUS_LABELS,
  TASK_STATUS_LABELS,
  countByStatus,
  daysUntil,
  formatCurrency,
  formatDate,
  firstName,
  initials,
  projectLifecycle,
  progressFromPeriod,
  shortPeriod,
  type DashboardDocument,
  type DashboardTask,
  type DashboardUser,
  type InstitutionalKpi,
  type ProjectView,
  type TaskStatus,
} from '@/lib/dashboard';
import {
  documentTypeLabel,
  downloadProjectDocument,
  fetchProjectDocuments,
  formatFileSize,
  type ProjectDocument,
} from '@/lib/documents';
import {
  getApolloClient,
  MY_PROJECTS_QUERY,
  type MyProjectSummary,
} from '@/lib/apollo-client';
import {
  GET_MILESTONES_QUERY,
  uploadMilestoneEvidence,
  confirmMilestoneEvidence,
} from '@/lib/milestones';

type TaskFilter = 'all' | TaskStatus;

const TASK_STATUS_STYLES: Record<TaskStatus, string> = {
  Pending: 'border-warning-line bg-warning-soft text-warning',
  In_Progress: 'border-brand-200 bg-brand-50 text-brand-800',
  Completed: 'border-success-line bg-success-soft text-success',
};

const TASK_DOT_STYLES: Record<TaskStatus, string> = {
  Pending: 'border-warning-line bg-warning-soft text-warning',
  In_Progress: 'border-brand-200 bg-brand-50 text-brand-700',
  Completed: 'border-success-line bg-success-soft text-success',
};

const TEAM_ROLE_LABELS: Record<string, string> = {
  Principal_Investigator: 'Investigador Principal',
  Co_Investigator: 'Co-Investigador',
  Assistant: 'Asistente de investigación',
};

interface GetMilestonesData {
  projectMilestones: MilestoneData[];
}
interface MilestoneData {
  milestoneId: number;
  name: string;
  status: string;
  dueDate: string;
  assigneeId: string;
  assigneeName: string;
}

/**
 * Panel de proyecto para Investigador Principal y miembros del equipo
 * (UC-009 / RF-008).
 *
 * Cada bloque declara su propio estado: proyectos, hitos y documentos. Así
 * una sección que todavía carga no se confunde con una sección vacía.
 */
export function ProjectDashboard({
  user,
  query,
}: {
  user: DashboardUser;
  query: string;
}) {
  const toast = useToast();
  const [projects, setProjects] = useState<MyProjectSummary[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [taskFilter, setTaskFilter] = useState<TaskFilter>('all');
  const [uploadingTask, setUploadingTask] = useState<string | null>(null);
  const [confirmingTask, setConfirmingTask] = useState<string | null>(null);

  // El cliente se memoiza: `getApolloClient()` crea una instancia nueva en
  // cada llamada y pasarla a `useQuery` en cada render provoca un bucle de
  // re-renders ("Too many re-renders"). Tambien evita perder la cache de
  // Apollo entre renders.
  const client = useMemo(() => getApolloClient(), []);

  useEffect(() => {
    let active = true;
    client
      .query<{ myProjects: MyProjectSummary[] }>({
        query: MY_PROJECTS_QUERY,
        fetchPolicy: 'network-only',
      })
      .then((result) => {
        if (active) {
          setProjects(result.data?.myProjects ?? []);
        }
      })
      .catch(() => {
        if (active) {
          setProjects(null);
          setLoadError(true);
        }
      });
    return () => {
      active = false;
    };
  }, [client, reloadKey]);

  const selectedProject =
    projects?.find((project) => String(project.projectId) === selectedId) ??
    projects?.[0] ??
    null;
  const realProjectId = selectedProject
    ? Number(selectedProject.projectId)
    : null;

  // US 5.2: tareas reales del backend (hitos del proyecto seleccionado).
  const {
    data: tasksData,
    loading: tasksLoading,
    error: tasksError,
    refetch: refetchTasks,
  } = useQuery<GetMilestonesData>(GET_MILESTONES_QUERY, {
    client,
    variables: { projectId: realProjectId || 0 },
    skip: !realProjectId,
    fetchPolicy: 'network-only',
  });

  const tasks: DashboardTask[] = useMemo(() => {
    if (!tasksData?.projectMilestones) {
      return [];
    }
    return tasksData.projectMilestones.map((milestone) => ({
      id: `MS-${milestone.milestoneId}`,
      title: milestone.name,
      // El backend usa `Delayed`; la vista solo distingue tres estados.
      status: (milestone.status === 'Delayed'
        ? 'Pending'
        : milestone.status) as TaskStatus,
      dueDate: milestone.dueDate,
      assignee: milestone.assigneeId === user.id ? 'me' : 'team',
      assigneeName:
        milestone.assigneeId === user.id ? user.name : milestone.assigneeName,
    }));
  }, [tasksData, user.id, user.name]);

  const [documentsState, setDocumentsState] = useState<{
    projectId: number;
    rows: DashboardDocument[];
  } | null>(null);
  const [documentsError, setDocumentsError] = useState<{
    projectId: number;
    message: string;
  } | null>(null);
  const [documentsReloadKey, setDocumentsReloadKey] = useState(0);

  useEffect(() => {
    if (realProjectId === null || Number.isNaN(realProjectId)) {
      return;
    }
    let active = true;
    fetchProjectDocuments(realProjectId)
      .then((rows) => {
        if (active) {
          setDocumentsState({
            projectId: realProjectId,
            rows: rows.map(mapProjectDocument),
          });
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setDocumentsError({
            projectId: realProjectId,
            message:
              error instanceof Error
                ? error.message
                : 'No fue posible cargar los documentos del proyecto.',
          });
        }
      });
    return () => {
      active = false;
    };
  }, [realProjectId, documentsReloadKey]);

  const documentsReady = documentsState?.projectId === realProjectId;
  const realDocuments = documentsReady ? documentsState.rows : null;
  const documentsLoading =
    realProjectId !== null &&
    !documentsReady &&
    documentsError?.projectId !== realProjectId;
  const currentDocumentsError =
    documentsError?.projectId === realProjectId ? documentsError.message : null;

  const documents = useMemo(() => realDocuments ?? [], [realDocuments]);

  const normalizedQuery = query.trim().toLowerCase();

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (taskFilter !== 'all' && task.status !== taskFilter) {
        return false;
      }
      if (!normalizedQuery) {
        return true;
      }
      return [task.id, task.title, task.assigneeName ?? '']
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [tasks, taskFilter, normalizedQuery]);

  const filteredDocuments = useMemo(() => {
    if (!normalizedQuery) {
      return documents;
    }
    return documents.filter((document) => {
      const visibility =
        document.visibility === 'Shared_with_administration'
          ? 'Equipo + Administración'
          : 'Solo equipo';
      return [document.name, document.type, visibility]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [documents, normalizedQuery]);

  const lifecycle = useMemo(
    () => projectLifecycle(selectedProject?.status ?? 'Draft'),
    [selectedProject?.status],
  );

  if (projects === null) {
    return loadError ? (
      <ProjectDashboardError
        onRetry={() => {
          setLoadError(false);
          setReloadKey((key) => key + 1);
        }}
      />
    ) : (
      <ProjectDashboardLoading />
    );
  }

  if (!selectedProject) {
    return <ProjectDashboardEmpty user={user} />;
  }

  const view = mapRealProject(selectedProject, user);
  const activeId = String(selectedProject.projectId);
  const isReadOnly = selectedProject.isReadOnly;
  const counts = countByStatus(tasks);
  const hasBudget =
    view.budget.enabled && user.role === 'PRINCIPAL_INVESTIGATOR';
  const riskCount = tasks.filter(
    (task) => task.status !== 'Completed' && daysUntil(task.dueDate) < 0,
  ).length;

  const handleUploadEvidence = async (milestoneId: number, file: File) => {
    if (isReadOnly) {
      toast.warning(
        'El proyecto está archivado en modo solo lectura; no admite nuevas evidencias.',
        'Proyecto archivado',
      );
      return;
    }
    setUploadingTask(`MS-${milestoneId}`);
    try {
      await uploadMilestoneEvidence(milestoneId, file);
      toast.success(
        'La tarea queda pendiente de confirmación por el Investigador Principal.',
        'Evidencia subida',
      );
      await refetchTasks();
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : 'No fue posible subir la evidencia.',
        'Error al subir la evidencia',
      );
    } finally {
      setUploadingTask(null);
    }
  };

  const handleConfirmMilestone = async (milestoneId: number) => {
    if (isReadOnly) {
      toast.warning(
        'El proyecto está archivado en modo solo lectura.',
        'Proyecto archivado',
      );
      return;
    }
    setConfirmingTask(`MS-${milestoneId}`);
    try {
      await confirmMilestoneEvidence(milestoneId);
      toast.success('La tarea quedó marcada como completada.', 'Tarea confirmada');
      await refetchTasks();
    } catch (error: unknown) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'No fue posible confirmar la tarea.',
        'Error al confirmar la tarea',
      );
    } finally {
      setConfirmingTask(null);
    }
  };

  const kpis: InstitutionalKpi[] = [
    {
      id: 'progress',
      label: 'Avance del proyecto',
      value: `${view.progress}%`,
      caption: `Etapa: ${lifecycle.steps.find((step) => step.id === lifecycle.currentId)?.name ?? '—'}`,
      icon: 'target',
      progress: {
        prefix: 'Periodo',
        highlight: view.period,
        percent: view.progress,
      },
      roles: [],
    },
    {
      id: 'tasks',
      label: 'Tareas asignadas',
      value: tasksLoading ? '—' : String(tasks.length),
      caption: 'Visibles según tu rol',
      icon: 'check',
      chips:
        tasksLoading && tasks.length === 0
          ? undefined
          : [
              { label: String(counts.Pending), value: 'Pendientes' },
              { label: String(counts.In_Progress), value: 'En progreso' },
              { label: String(counts.Completed), value: 'Completadas' },
            ],
      roles: [],
    },
    {
      id: 'documents',
      label: 'Documentos del expediente',
      value: documentsLoading ? '—' : String(documents.length),
      caption: documents[0]
        ? `Última carga: ${formatDate(documents[0].uploadedAt)}`
        : documentsLoading
          ? 'Consultando el expediente…'
          : 'Sin documentos cargados',
      icon: 'doc',
      chips: documentsLoading
        ? undefined
        : [
            {
              label: String(
                documents.filter(
                  (doc) => doc.visibility === 'Shared_with_administration',
                ).length,
              ),
              value: 'Compartidos',
            },
            {
              label: String(
                documents.filter((doc) => doc.visibility === 'Team_only').length,
              ),
              value: 'Solo equipo',
            },
          ],
      roles: [],
    },
    hasBudget
      ? {
          id: 'budget',
          label: 'Presupuesto ejercido',
          value: formatCurrency(view.budget.spent),
          caption: 'Gastos registrados en el proyecto',
          icon: 'wallet',
          roles: [],
        }
      : {
          id: 'risk',
          label: 'Entregables en riesgo',
          value: tasksLoading ? '—' : String(riskCount),
          caption: riskCount > 0 ? 'Retraso Crítico' : 'Sin retrasos',
          icon: 'alert',
          alert:
            riskCount > 0
              ? 'Alerta automática por retraso mayor a 7 días. Notificación enviada al Investigador Principal.'
              : undefined,
          roles: [],
        },
  ];

  function handleExport() {
    const header = ['ID', 'Tarea', 'Responsable', 'Estado', 'Vencimiento'];
    const rows = tasks.map((task) => [
      task.id,
      task.title,
      task.assignee === 'me' ? user.name : (task.assigneeName ?? 'Equipo'),
      TASK_STATUS_LABELS[task.status],
      formatDate(task.dueDate),
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(';'))
      .join('\r\n');
    const blob = new Blob([`\uFEFF${csv}`], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `athenea-${view.id}-tareas.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('El reporte de tareas se descargó.', 'Reporte listo');
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <PageHeader
          title="Panel de Proyecto"
          description="Ciclo de investigación, tareas asignadas, objetivos y evidencia documental en una sola vista."
          actions={
            <>
              <label className="sr-only" htmlFor="project-selector">
                Proyecto
              </label>
              <select
                id="project-selector"
                value={activeId}
                onChange={(event) => {
                  setSelectedId(event.target.value);
                  setTaskFilter('all');
                }}
                className="h-9 max-w-[280px] rounded-lg border border-line-strong bg-white px-3 pr-8 text-xs font-medium text-ink transition-colors duration-150 hover:border-brand-300 focus:border-brand-400"
              >
                {projects.map((project) => (
                  <option
                    key={project.projectId}
                    value={String(project.projectId)}
                  >
                    {project.title.slice(0, 60)}
                  </option>
                ))}
              </select>
              <Button
                size="sm"
                onClick={handleExport}
                disabled={tasks.length === 0}
                leadingIcon={<Icon name="download" className="h-4 w-4" />}
              >
                Descargar reporte
              </Button>
            </>
          }
        />

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-success-line bg-success-soft px-2.5 py-1 text-[10.5px] font-medium text-success">
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full bg-success"
            />
            Proyecto sincronizado
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-2.5 py-1 text-[10.5px] font-medium text-muted">
            <Icon name="eye" className="h-3 w-3" />
            Vista: {ROLE_LABELS[user.role]}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-2.5 py-1 text-[10.5px] font-medium text-muted">
            {view.id}
          </span>
          {tasksLoading && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-warning-line bg-warning-soft px-2.5 py-1 text-[10.5px] font-medium text-warning">
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500"
              />
              Actualizando tareas…
            </span>
          )}
        </div>
      </div>

      {tasksError && (
        <Alert
          tone="danger"
          action={
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                void refetchTasks();
              }}
            >
              Reintentar
            </Button>
          }
        >
          No pudimos actualizar los hitos del proyecto. Los datos en pantalla
          pueden estar desactualizados.
        </Alert>
      )}

      <section
        aria-labelledby="project-objectives-heading"
        className="rounded-xl border border-line bg-white p-5 lg:p-6"
      >
        <h2 id="project-objectives-heading" className="sr-only">
          Objetivos del proyecto
        </h2>

        <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-brand-800">
                Proyecto {STATUS_LABELS[view.status] ?? view.status}
              </span>
              {isReadOnly && (
                <span
                  className="inline-flex items-center gap-1 rounded-full border border-warning-line bg-warning-soft px-2.5 py-1 text-[10px] font-semibold text-warning"
                  title={
                    selectedProject.archivedAt
                      ? `Archivado el ${formatDate(selectedProject.archivedAt)}`
                      : 'Proyecto archivado en modo solo lectura'
                  }
                >
                  <Icon name="stamp" className="h-3 w-3" />
                  Archivo institucional · Solo lectura
                </span>
              )}
              <span className="text-[10.5px] text-muted">{view.call}</span>
            </div>

            <h3 className="mt-3 max-w-3xl text-[22px] font-semibold leading-snug tracking-tight text-ink lg:text-[25px]">
              {view.title}
            </h3>
            <p className="mt-2 max-w-3xl text-[12.5px] leading-relaxed text-muted">
              {view.description}
            </p>

            <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
              Objetivos principales
            </p>
            <ul className="mt-2 space-y-2">
              {view.objectives.map((objective) => (
                <li
                  key={objective}
                  className="flex items-start gap-2 text-[12px] leading-snug text-ink"
                >
                  <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700">
                    <Icon name="check" className="h-2.5 w-2.5" />
                  </span>
                  {objective}
                </li>
              ))}
            </ul>
          </div>

          <aside className="rounded-lg border border-line bg-surface-2 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
              Ficha del proyecto
            </p>
            <dl className="mt-3 space-y-2.5 text-[11.5px]">
              <MetaRow label="Investigador (PI)" value={view.pi} />
              <MetaRow label="Periodo" value={view.period} />
              <MetaRow label="Convocatoria" value={view.call} />
            </dl>

            <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
              Equipo
            </p>
            <ul className="mt-2 space-y-2">
              {view.team.map((member) => (
                <li key={member.name} className="flex items-center gap-2">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-100 text-[9px] font-semibold text-brand-800">
                    {initials(member.name)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[11.5px] font-medium text-ink">
                      {member.name}
                    </span>
                    <span className="block truncate text-[10px] text-muted">
                      {member.role}
                    </span>
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-4 rounded-md border border-line bg-white p-2.5">
              <div className="flex items-center justify-between text-[10px] text-muted">
                <span>Avance del periodo</span>
                <strong className="font-semibold tabular-nums text-ink">
                  {view.progress}%
                </strong>
              </div>
              <ProgressBar
                className="mt-1.5"
                label="Avance del periodo"
                size="sm"
                value={view.progress}
              />
            </div>
          </aside>
        </div>
      </section>

      <section
        aria-label="Indicadores del proyecto"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {kpis.map((kpi) => (
          <KpiCard key={kpi.id} kpi={kpi} />
        ))}
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <section className="rounded-xl border border-line bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-[17px] font-semibold tracking-tight text-ink">
                Seguimiento de Tareas Asignadas
              </h2>
              <p className="mt-1 text-[11.5px] text-muted">
                Compromisos del equipo y entregables del ciclo activo
              </p>
            </div>
            <span
              aria-live="polite"
              className="rounded-full border border-line bg-surface-2 px-2.5 py-1 text-[10px] font-medium text-muted"
            >
              {filteredTasks.length} tareas visibles
            </span>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2.5">
            <TaskSummaryTile
              label="Pendientes"
              value={counts.Pending}
              tone="warning"
            />
            <TaskSummaryTile
              label="En progreso"
              value={counts.In_Progress}
              tone="brand"
            />
            <TaskSummaryTile
              label="Completadas"
              value={counts.Completed}
              tone="success"
            />
          </div>

          <div
            className="mt-4 flex flex-wrap gap-1.5"
            role="group"
            aria-label="Filtrar tareas por estado"
          >
            {(
              [
                ['all', 'Todas'],
                ['Pending', 'Pendientes'],
                ['In_Progress', 'En progreso'],
                ['Completed', 'Completadas'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setTaskFilter(value)}
                aria-pressed={taskFilter === value}
                className={`rounded-full border px-2.5 py-1 text-[10.5px] font-medium transition-[background-color,border-color,color] duration-150 ease-snappy ${
                  taskFilter === value
                    ? 'border-brand-800 bg-brand-800 text-white'
                    : 'border-line bg-white text-muted hover:border-brand-300 hover:text-brand-800'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <ul className="mt-3 space-y-2">
            {tasksLoading && tasks.length === 0 && (
              <li aria-busy="true" className="space-y-2">
                <span className="sr-only">Cargando tareas del proyecto…</span>
                {[0, 1, 2].map((index) => (
                  <div
                    key={index}
                    aria-hidden="true"
                    className="flex items-center gap-3 rounded-lg border border-line/80 px-3 py-2.5"
                  >
                    <Skeleton className="h-6 w-6 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3 w-2/3" />
                      <Skeleton className="h-2.5 w-1/3" />
                    </div>
                    <Skeleton className="h-3 w-16" />
                  </div>
                ))}
              </li>
            )}

            {!tasksLoading &&
              filteredTasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  userName={user.name}
                  onUpload={handleUploadEvidence}
                  uploading={uploadingTask === task.id}
                  onConfirm={handleConfirmMilestone}
                  confirming={confirmingTask === task.id}
                  isPi={user.role === 'PRINCIPAL_INVESTIGATOR'}
                  readOnly={isReadOnly}
                />
              ))}

            {!tasksLoading && filteredTasks.length === 0 && (
              <li>
                <EmptyState
                  compact
                  title={
                    tasks.length === 0
                      ? 'El proyecto aún no tiene hitos registrados'
                      : 'No hay tareas con este estado'
                  }
                  description={
                    tasks.length === 0
                      ? 'Cuando el cronograma se cargue, cada hito aparecerá aquí con su responsable y fecha de entrega.'
                      : 'Cambia el filtro para ver el resto de los compromisos del equipo.'
                  }
                  action={
                    tasks.length > 0 && taskFilter !== 'all' ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setTaskFilter('all')}
                      >
                        Ver todas las tareas
                      </Button>
                    ) : undefined
                  }
                />
              </li>
            )}
          </ul>
        </section>

        <section className="rounded-xl border border-line bg-white p-5">
          <h2 className="text-[17px] font-semibold tracking-tight text-ink">
            Ciclo de Vida
          </h2>
          <p className="mt-1 text-[11.5px] text-muted">
            Fase actual del proyecto dentro del proceso institucional
          </p>

          <div className="mt-4">
            <LifecycleFunnel model={lifecycle} mode="project" />
          </div>

          <p className="mt-4 rounded-md border border-line bg-surface-2 px-2.5 py-2 text-[10.5px] leading-relaxed text-muted">
            La etapa activa se actualiza automáticamente cuando el proyecto
            cambia de estado. Las fechas de entrega se validan contra los hitos
            pactados.
          </p>
        </section>
      </div>

      <section className="rounded-xl border border-line bg-white">
        <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
          <div>
            <h2 className="text-[17px] font-semibold tracking-tight text-ink">
              Documentación y Evidencia Reciente
            </h2>
            <p className="mt-1 text-[11.5px] text-muted">
              Acceso directo a los últimos archivos del expediente
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              aria-live="polite"
              className="rounded-full border border-line bg-surface-2 px-2.5 py-1 text-[10px] font-medium text-muted"
            >
              {documentsLoading ? 'Cargando…' : `${filteredDocuments.length} documentos`}
            </span>
            <ButtonLink
              href={`/projects/${selectedProject.projectId}/documents`}
              size="sm"
              variant="secondary"
              leadingIcon={<Icon name="folder" className="h-3.5 w-3.5" />}
            >
              Ver repositorio
            </ButtonLink>
          </div>
        </div>

        {currentDocumentsError && (
          <Alert
            tone="danger"
            className="mx-5 mt-4"
            action={
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setDocumentsError(null);
                  setDocumentsReloadKey((key) => key + 1);
                }}
              >
                Reintentar
              </Button>
            }
          >
            {currentDocumentsError}
          </Alert>
        )}

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left">
            <caption className="sr-only">
              Documentos recientes del proyecto con tipo, visibilidad y acceso
            </caption>
            <thead>
              <tr className="border-y border-line bg-surface-2 text-[9.5px] font-semibold uppercase tracking-[0.08em] text-muted">
                <th scope="col" className="px-5 py-2.5">
                  Documento
                </th>
                <th scope="col" className="px-3 py-2.5">
                  Tipo
                </th>
                <th scope="col" className="px-3 py-2.5">
                  Carga
                </th>
                <th scope="col" className="px-3 py-2.5">
                  Visibilidad
                </th>
                <th scope="col" className="px-5 py-2.5 text-right">
                  Acceso
                </th>
              </tr>
            </thead>
            <tbody>
              {documentsLoading && <SkeletonRows rows={3} columns={5} />}

              {!documentsLoading &&
                filteredDocuments.map((document) => (
                  <DocumentRow key={document.id} document={document} />
                ))}

              {!documentsLoading &&
                !currentDocumentsError &&
                filteredDocuments.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-10">
                      <EmptyState
                        compact
                        title={
                          documents.length === 0
                            ? 'El expediente está vacío'
                            : 'Ningún documento coincide con la búsqueda'
                        }
                        description={
                          documents.length === 0
                            ? 'Sube el primer documento desde el repositorio del proyecto.'
                            : 'Limpia la búsqueda global para ver todos los archivos.'
                        }
                        action={
                          documents.length === 0 ? (
                            <ButtonLink
                              href={`/projects/${selectedProject.projectId}/documents`}
                              size="sm"
                              variant="secondary"
                            >
                              Abrir repositorio
                            </ButtonLink>
                          ) : undefined
                        }
                      />
                    </td>
                  </tr>
                )}
            </tbody>
          </table>
        </div>

        <div className="border-t border-line px-5 py-3">
          <p className="text-[10.5px] leading-relaxed text-muted">
            La administración solo recibe los documentos compartidos; los
            marcados como “Solo equipo” nunca salen del equipo del proyecto. Los
            documentos de revisión obligatoria siempre se comparten.
          </p>
        </div>
      </section>
    </div>
  );
}

function ProjectDashboardLoading() {
  return (
    <div className="space-y-6" aria-busy="true">
      <span className="sr-only">Cargando proyectos y tareas del servidor…</span>

      <div className="space-y-3">
        <Skeleton className="h-7 w-64 max-w-full" />
        <Skeleton className="h-3 w-[30rem] max-w-full" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="rounded-xl border border-line bg-white p-5">
            <Skeleton className="h-2.5 w-24" />
            <Skeleton className="mt-4 h-7 w-16" />
            <Skeleton className="mt-3 h-2.5 w-32" />
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-line bg-white p-5 lg:p-6">
        <Skeleton className="h-3 w-48" />
        <Skeleton className="mt-4 h-3 w-full" />
        <Skeleton className="mt-2 h-3 w-5/6" />
        <Skeleton className="mt-2 h-3 w-2/3" />
      </div>
    </div>
  );
}

function ProjectDashboardError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Panel de Proyecto"
        description="Ciclo de investigación, tareas asignadas, objetivos y evidencia documental en una sola vista."
      />
      <ErrorState
        className="min-h-[320px] justify-center bg-white"
        title="No pudimos cargar tus proyectos"
        description="Revisa tu conexión e inténtalo de nuevo. Si el problema continúa, contacta a la Vicerrectoría de I+D+I."
        onRetry={onRetry}
      />
    </div>
  );
}

function ProjectDashboardEmpty({ user }: { user: DashboardUser }) {
  const canRegister = user.role === 'PRINCIPAL_INVESTIGATOR';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Panel de Proyecto"
        description="Ciclo de investigación, tareas asignadas, objetivos y evidencia documental en una sola vista."
      />

      <EmptyState
        className="bg-white px-6 py-12 lg:py-16"
        icon={<Icon name="folder" className="h-5 w-5" />}
        title="Aún no tienes proyectos asignados"
        description={
          canRegister
            ? 'Registra tu primer proyecto para consultar objetivos, hitos, equipo y evidencia documental desde este panel.'
            : 'Cuando el Investigador Principal te añada a un equipo de investigación, aquí verás tus tareas y el expediente del proyecto.'
        }
        action={
          <>
            {canRegister && (
              <ButtonLink
                href="/projects/new"
                leadingIcon={<Icon name="register" className="h-4 w-4" />}
              >
                Registrar proyecto
              </ButtonLink>
            )}
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-2.5 py-1 text-[10.5px] font-medium text-muted">
              <Icon name="eye" className="h-3 w-3" />
              Vista: {ROLE_LABELS[user.role]}
            </span>
          </>
        }
      />
    </div>
  );
}

function mapRealProject(
  project: MyProjectSummary,
  user: DashboardUser,
): ProjectView {
  const objectives = project.objectives
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const year = new Date(project.startDate).getFullYear();
  const code = `UPD-${Number.isNaN(year) ? 2026 : year}-${String(project.projectId).padStart(3, '0')}`;
  const description =
    project.objectives.length > 260
      ? `${project.objectives.slice(0, 257)}…`
      : project.objectives;

  const milestoneProgress =
    project.milestonesTotal > 0
      ? Math.round(
          (project.milestonesCompleted / project.milestonesTotal) * 100,
        )
      : null;

  return {
    id: code,
    title: project.title,
    description,
    objectives: objectives.length > 0 ? objectives : [project.objectives],
    pi: project.piName ?? 'No registrado',
    period: shortPeriod(project.startDate, project.endDate),
    call: project.callTitle ?? 'Sin convocatoria asociada',
    status: project.status,
    progress:
      milestoneProgress ??
      (project.status === 'Completed'
        ? 100
        : progressFromPeriod(project.startDate, project.endDate)),
    budget: {
      enabled: project.budgetEnabled,
      spent: project.budgetSpent ?? 0,
    },
    team:
      project.team.length > 0
        ? project.team.map((member) => ({
            name: member.name,
            role: TEAM_ROLE_LABELS[member.role] ?? member.role,
          }))
        : [
            {
              name: user.name,
              role:
                user.role === 'PRINCIPAL_INVESTIGATOR'
                  ? 'Investigador Principal'
                  : 'Miembro del Equipo',
            },
          ],
  };
}

function mapProjectDocument(document: ProjectDocument): DashboardDocument {
  return {
    id: `DOC-${document.documentId}`,
    documentId: document.documentId,
    name: document.fileName ?? `Documento #${document.documentId}`,
    type: documentTypeLabel(document.docType),
    size: formatFileSize(document.fileSize),
    uploadedAt: document.uploadedAt,
    visibility:
      document.visibility === 'SHARED_WITH_ADMINISTRATION'
        ? 'Shared_with_administration'
        : 'Team_only',
    mandatoryReview: document.mandatoryReview,
    canChangeVisibility: document.canChangeVisibility,
  };
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="text-right font-medium text-ink">{value}</dd>
    </div>
  );
}

function TaskSummaryTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'warning' | 'brand' | 'success';
}) {
  const toneStyles = {
    warning: 'border-warning-line bg-warning-soft text-warning',
    brand: 'border-brand-200 bg-brand-50 text-brand-800',
    success: 'border-success-line bg-success-soft text-success',
  } as const;

  return (
    <div className={`rounded-lg border px-3 py-2 ${toneStyles[tone]}`}>
      <p className="text-[19px] font-semibold leading-none tabular-nums">
        {value}
      </p>
      <p className="mt-1 text-[10px] font-medium uppercase tracking-wide opacity-80">
        {label}
      </p>
    </div>
  );
}

/** Fila de tarea con acciones de evidencia y confirmación. */
function TaskRow({
  task,
  userName,
  onUpload,
  uploading,
  onConfirm,
  confirming,
  isPi,
  readOnly,
}: {
  task: DashboardTask;
  userName: string;
  onUpload: (id: number, file: File) => void;
  uploading: boolean;
  onConfirm: (id: number) => void;
  confirming: boolean;
  isPi: boolean;
  readOnly: boolean;
}) {
  const due = formatDate(task.dueDate);
  const assignee =
    task.assignee === 'me' ? `Tú (${firstName(userName)})` : task.assigneeName;
  const milestoneNumericId = Number(task.id.replace('MS-', ''));
  const isRealMilestone = task.id.startsWith('MS-');
  const busy = uploading || confirming;

  return (
    <li
      aria-busy={busy || undefined}
      className="flex items-start gap-3 rounded-lg border border-line/80 px-3 py-2.5 transition-[border-color,background-color] duration-150 ease-snappy hover:border-brand-200 hover:bg-surface-2"
    >
      <span
        aria-hidden="true"
        className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border ${TASK_DOT_STYLES[task.status]}`}
      >
        {task.status === 'Completed' ? (
          <Icon name="check" className="h-3 w-3" />
        ) : task.status === 'In_Progress' ? (
          <Icon name="clock" className="h-3 w-3" />
        ) : (
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
        )}
      </span>

      <div className="min-w-0 flex-1">
        <p
          className={`text-[12px] font-medium leading-snug ${
            task.status === 'Completed'
              ? 'text-muted line-through'
              : 'text-ink'
          }`}
        >
          {task.title}
        </p>
        <p className="mt-0.5 text-[10px] text-muted">
          {task.id} &middot; {assignee}
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1.5 text-right">
        <p className="text-[10px] text-muted">{due}</p>
        <span
          className={`inline-flex rounded-full border px-2 py-0.5 text-[9.5px] font-semibold ${TASK_STATUS_STYLES[task.status]}`}
        >
          {TASK_STATUS_LABELS[task.status]}
        </span>

        {readOnly && task.status !== 'Completed' && isRealMilestone && (
          <span className="mt-1 inline-flex items-center gap-1 rounded border border-warning-line bg-warning-soft px-2 py-1 text-[10px] font-medium text-warning">
            <Icon name="stamp" className="h-3 w-3" />
            Solo lectura
          </span>
        )}

        {!readOnly &&
          task.assignee === 'me' &&
          task.status !== 'Completed' &&
          isRealMilestone && (
            <div className="mt-1">
              <input
                type="file"
                id={`file-${task.id}`}
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) onUpload(milestoneNumericId, file);
                  event.target.value = '';
                }}
                disabled={busy}
              />
              <label
                htmlFor={`file-${task.id}`}
                aria-disabled={busy || undefined}
                className={`inline-flex items-center gap-1 rounded border border-brand-200 bg-brand-50 px-2 py-1 text-[10px] font-medium text-brand-700 transition-colors duration-150 hover:bg-brand-100 ${
                  busy
                    ? 'pointer-events-none opacity-60'
                    : 'cursor-pointer'
                }`}
              >
                {uploading ? (
                  <Spinner className="h-3 w-3" />
                ) : (
                  <Icon name="arrowUpRight" className="h-3 w-3" />
                )}
                {uploading ? 'Subiendo…' : 'Evidencia'}
              </label>
            </div>
          )}

        {!readOnly &&
          isPi &&
          task.status !== 'Completed' &&
          isRealMilestone && (
            <button
              type="button"
              onClick={() => onConfirm(milestoneNumericId)}
              disabled={busy}
              className="mt-1 inline-flex items-center gap-1 rounded border border-success-line bg-success-soft px-2 py-1 text-[10px] font-medium text-success transition-colors duration-150 hover:bg-success-soft/80 disabled:pointer-events-none disabled:opacity-60"
            >
              {confirming ? (
                <Spinner className="h-3 w-3" />
              ) : (
                <Icon name="check" className="h-3 w-3" />
              )}
              {confirming ? 'Confirmando…' : 'Confirmar'}
            </button>
          )}
      </div>
    </li>
  );
}

function DocumentRow({ document }: { document: DashboardDocument }) {
  const toast = useToast();
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    if (!document.documentId) {
      return;
    }
    setDownloading(true);
    try {
      await downloadProjectDocument(document.documentId);
      toast.success('La descarga del documento comenzó.', 'Descarga iniciada');
    } catch (error: unknown) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'No fue posible descargar el documento.',
        'Error al descargar',
      );
    } finally {
      setDownloading(false);
    }
  }

  return (
    <tr className="border-b border-line/70 align-middle transition-colors duration-150 hover:bg-surface-2">
      <td className="px-5 py-3">
        <span className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-brand-50 text-brand-700">
            <Icon name="doc" className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block max-w-[340px] truncate text-[11.5px] font-medium text-ink">
              {document.name}
            </span>
            <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-muted">
              {document.id} · {document.size}
              {document.mandatoryReview && (
                <span className="inline-flex rounded-full border border-warning-line bg-warning-soft px-1.5 py-0.5 text-[9px] font-semibold text-warning">
                  Revisión obligatoria
                </span>
              )}
            </span>
          </span>
        </span>
      </td>
      <td className="px-3 py-3 text-[11px] text-muted">{document.type}</td>
      <td className="px-3 py-3 text-[11px] text-muted">
        {formatDate(document.uploadedAt)}
      </td>
      <td className="px-3 py-3">
        <span className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-2 px-2 py-0.5 text-[9.5px] font-medium text-muted">
          {document.visibility === 'Shared_with_administration'
            ? 'Equipo + Administración'
            : 'Solo equipo'}
        </span>
      </td>
      <td className="px-5 py-3 text-right">
        <button
          type="button"
          onClick={() => void handleDownload()}
          disabled={!document.documentId || downloading}
          title="Descargar documento"
          className="inline-flex items-center gap-1.5 rounded-md border border-line-strong bg-white px-2.5 py-1 text-[10.5px] font-medium text-ink transition-colors duration-150 hover:border-brand-300 hover:bg-surface-2 disabled:pointer-events-none disabled:opacity-50"
        >
          {downloading ? (
            <Spinner className="h-3.5 w-3.5" />
          ) : (
            <Icon name="download" className="h-3.5 w-3.5" />
          )}
          {downloading ? 'Descargando…' : 'Descargar'}
        </button>
      </td>
    </tr>
  );
}
