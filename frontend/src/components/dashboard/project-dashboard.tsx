'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
//import { useQuery } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
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
  fetchProjectDocuments,
  formatFileSize,
  type ProjectDocument,
} from '@/lib/documents';
import {
  getApolloClient,
  MY_PROJECTS_QUERY,
  type MyProjectSummary,
} from '@/lib/apollo-client';
import { GET_MILESTONES_QUERY, uploadMilestoneEvidence } from '@/lib/milestones';

type TaskFilter = 'all' | TaskStatus;

const TASK_STATUS_STYLES: Record<TaskStatus, string> = {
  Pending: 'border-amber-200 bg-amber-50 text-amber-800',
  In_Progress: 'border-brand-200 bg-brand-50 text-brand-800',
  Completed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
};

const TASK_DOT_STYLES: Record<TaskStatus, string> = {
  Pending: 'border-amber-300 bg-amber-50 text-amber-700',
  In_Progress: 'border-brand-300 bg-brand-50 text-brand-700',
  Completed: 'border-emerald-300 bg-emerald-50 text-emerald-700',
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
 */
export function ProjectDashboard({
  user,
  query,
}: {
  user: DashboardUser;
  query: string;
}) {
  const [projects, setProjects] = useState<MyProjectSummary[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [taskFilter, setTaskFilter] = useState<TaskFilter>('all');
  const [uploadingTask, setUploadingTask] = useState<string | null>(null);

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
  const { data: tasksData, refetch: refetchTasks } = useQuery<GetMilestonesData>(
    GET_MILESTONES_QUERY,
    {
      client,
      variables: { projectId: realProjectId || 0 },
      skip: !realProjectId,
      fetchPolicy: 'network-only',
    },
  );

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
        milestone.assigneeId === user.id
          ? user.name
          : milestone.assigneeName,
    }));
  }, [tasksData, user.id, user.name]);

  const [documentsState, setDocumentsState] = useState<{
    projectId: number;
    rows: DashboardDocument[];
  } | null>(null);

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
      .catch(() => {
        // Sin documentos accesibles se muestra el estado vacio.
      });
    return () => {
      active = false;
    };
  }, [realProjectId]);

  const realDocuments =
    documentsState && documentsState.projectId === realProjectId
      ? documentsState.rows
      : null;

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
      alert(
        'El proyecto está archivado en modo solo lectura (RF-020); no admite nuevas evidencias.',
      );
      return;
    }
    setUploadingTask(`MS-${milestoneId}`);
    try {
      await uploadMilestoneEvidence(milestoneId, file);
      alert('Evidencia subida y tarea completada con éxito.');
      refetchTasks();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Error al subir la evidencia';
      alert(message);
    } finally {
      setUploadingTask(null);
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
      value: String(tasks.length),
      caption: 'Visibles según tu rol (RF-001)',
      icon: 'check',
      chips: [
        { label: String(counts.Pending), value: 'Pendientes' },
        { label: String(counts.In_Progress), value: 'En progreso' },
        { label: String(counts.Completed), value: 'Completadas' },
      ],
      roles: [],
    },
    {
      id: 'documents',
      label: 'Documentos del expediente',
      value: String(documents.length),
      caption: documents[0]
        ? `Última carga: ${formatDate(documents[0].uploadedAt)}`
        : 'Sin documentos cargados',
      icon: 'doc',
      chips: [
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
          value: String(riskCount),
          caption: riskCount > 0 ? 'Retraso Crítico' : 'Sin retrasos',
          icon: 'alert',
          alert:
            riskCount > 0
              ? 'Alerta automatizada (Cron >7 días RF-006). Notificación enviada al PI.'
              : undefined,
          roles: [],
        },
  ];

  function handleExport() {
    const header = [
      'ID',
      'Tarea',
      'Responsable',
      'Estado',
      'Vencimiento',
    ];
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
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
          UNIPOLI · Vicerrectoría de I+D+I ·{' '}
          <span className="text-brand-700">{view.id}</span>
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-100 bg-brand-50 px-2.5 py-1 text-[10.5px] font-medium text-brand-800">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Proyecto sincronizado con GraphQL
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-2.5 py-1 text-[10.5px] font-medium text-muted">
            <Icon name="eye" className="h-3 w-3" />
            Vista filtrada por rol: {ROLE_LABELS[user.role]} (RF-001)
          </span>
        </div>

        <div className="mt-3 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 xl:flex-1">
            <h1 className="text-[30px] font-semibold leading-tight tracking-tight text-ink sm:text-[36px]">
              Panel de Proyecto
            </h1>
            <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-muted">
              Ciclo de investigación, tareas asignadas, objetivos y evidencia
              documental en una sola vista.
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2.5 xl:ml-auto">
            <label className="sr-only" htmlFor="project-selector">
              Proyecto
            </label>
            <select
              id="project-selector"
              value={activeId}
              onChange={(event) => setSelectedId(event.target.value)}
              className="h-9 max-w-[280px] rounded-md border border-line bg-white px-3 pr-8 text-xs font-medium text-ink focus:border-brand-300 focus:outline-none"
            >
              {projects.map((project) => (
                <option key={project.projectId} value={String(project.projectId)}>
                  {project.title.slice(0, 60)}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleExport}
              disabled={tasks.length === 0}
              className="inline-flex h-9 items-center gap-2 rounded-md bg-brand-900 px-3.5 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Icon name="download" className="h-4 w-4" />
              Descargar reporte
            </button>
          </div>
        </div>
      </header>

      <section
        aria-labelledby="project-objectives-heading"
        className="rounded-xl border border-line bg-white p-5 shadow-[0_1px_2px_rgba(16,35,61,0.04)] lg:p-6"
      >
        <h2 id="project-objectives-heading" className="sr-only">
          Objetivos del proyecto
        </h2>

        <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-brand-100 bg-brand-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-brand-800">
                Proyecto {STATUS_LABELS[view.status] ?? view.status}
              </span>
              {isReadOnly && (
                <span
                  className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-800"
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
              <span className="rounded-md border border-line bg-[#f8f9fd] px-2 py-0.5 text-[10px] font-semibold tracking-wide text-brand-700">
                {view.id}
              </span>
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

          <aside className="rounded-lg border border-line bg-[#f8f9fd] p-4">
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
                <strong className="font-semibold text-ink">
                  {view.progress}%
                </strong>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#e8edf7]">
                <div
                  className="h-full rounded-full bg-brand-600"
                  style={{ width: `${view.progress}%` }}
                />
              </div>
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
        <section className="rounded-xl border border-line bg-white p-5 shadow-[0_1px_2px_rgba(16,35,61,0.04)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-[17px] font-semibold tracking-tight text-ink">
                Seguimiento de Tareas Asignadas
              </h2>
              <p className="mt-1 text-[11.5px] text-muted">
                Compromisos del equipo y entregables del ciclo activo (RF-006)
              </p>
            </div>
            <span className="rounded-full border border-line bg-[#f8f9fd] px-2.5 py-1 text-[10px] font-medium text-muted">
              {filteredTasks.length} tareas visibles
            </span>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2.5">
            <TaskSummaryTile
              label="Pendientes"
              value={counts.Pending}
              tone="amber"
            />
            <TaskSummaryTile
              label="En progreso"
              value={counts.In_Progress}
              tone="brand"
            />
            <TaskSummaryTile
              label="Completadas"
              value={counts.Completed}
              tone="emerald"
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-1.5">
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
                className={`rounded-full border px-2.5 py-1 text-[10.5px] font-medium transition ${
                  taskFilter === value
                    ? 'border-brand-800 bg-brand-800 text-white'
                    : 'border-line bg-white text-muted hover:border-brand-200 hover:text-brand-800'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <ul className="mt-3 space-y-2">
            {filteredTasks.map((task) => (
              <TaskRow 
                key={task.id} 
                task={task} 
                userName={user.name} 
                onUpload={handleUploadEvidence}
                uploading={uploadingTask === task.id}
                readOnly={isReadOnly}
              />
            ))}
            {filteredTasks.length === 0 && (
              <li className="rounded-lg border border-line bg-[#f8f9fd] px-3 py-6 text-center text-[11.5px] text-muted">
                {tasks.length === 0
                  ? 'El proyecto aún no tiene hitos o tareas registradas.'
                  : 'No hay tareas que coincidan con el filtro seleccionado.'}
              </li>
            )}
          </ul>
        </section>

        <section className="rounded-xl border border-line bg-white p-5 shadow-[0_1px_2px_rgba(16,35,61,0.04)]">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-[17px] font-semibold tracking-tight text-ink">
              Ciclo de Vida
            </h2>
            <span className="shrink-0 text-[10px] font-medium text-muted">
              RF-003
            </span>
          </div>
          <p className="mt-1 text-[11.5px] text-muted">
            Fase actual del proyecto dentro del proceso institucional
          </p>

          <div className="mt-4">
            <LifecycleFunnel model={lifecycle} mode="project" />
          </div>

          <p className="mt-4 rounded-md border border-line bg-[#f8f9fd] px-2.5 py-2 text-[10.5px] leading-relaxed text-muted">
            La etapa activa se actualiza automáticamente cuando el proyecto
            cambia de estado (RF-003). Las fechas de entrega se validan contra
            los hitos pactados (RF-006).
          </p>
        </section>
      </div>

      <section className="rounded-xl border border-line bg-white shadow-[0_1px_2px_rgba(16,35,61,0.04)]">
        <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
          <div>
            <h2 className="text-[17px] font-semibold tracking-tight text-ink">
              Documentación y Evidencia Reciente
            </h2>
            <p className="mt-1 text-[11.5px] text-muted">
              Acceso directo a los últimos archivos del expediente (RF-005)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-line bg-[#f8f9fd] px-2.5 py-1 text-[10px] font-medium text-muted">
              {filteredDocuments.length} documentos
            </span>
            <Link
              href={`/projects/${selectedProject.projectId}/documents`}
              className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-[10.5px] font-medium text-brand-700 transition hover:bg-brand-50"
            >
              <Icon name="folder" className="h-3.5 w-3.5" />
              Ver repositorio
            </Link>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left">
            <caption className="sr-only">
              Documentos recientes del proyecto con tipo, visibilidad y acceso
            </caption>
            <thead>
              <tr className="border-y border-line bg-[#f8f9fd] text-[9.5px] font-semibold uppercase tracking-[0.08em] text-muted">
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
              {filteredDocuments.map((document) => (
                <DocumentRow key={document.id} document={document} />
              ))}
              {filteredDocuments.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-10 text-center text-[12px] text-muted"
                  >
                    {documents.length === 0
                      ? 'El proyecto aún no tiene documentos cargados.'
                      : 'No hay documentos que coincidan con la búsqueda.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="border-t border-line px-5 py-3">
          <p className="text-[10.5px] leading-relaxed text-muted">
            La administración solo recibe los documentos compartidos; los
            marcados como “Solo equipo” nunca salen del equipo del proyecto
            (RF-005). Los documentos de revisión obligatoria siempre se
            comparten.
          </p>
        </div>
      </section>
    </div>
  );
}

function ProjectDashboardLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <div className="space-y-2">
        <span className="block h-2.5 w-40 animate-pulse rounded bg-[#e8edf7]" />
        <span className="block h-8 w-64 animate-pulse rounded bg-[#e8edf7]" />
        <span className="block h-3 w-full max-w-xl animate-pulse rounded bg-[#eef2fa]" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div
            key={item}
            className="rounded-xl border border-line bg-white p-5 shadow-[0_1px_2px_rgba(16,35,61,0.04)]"
          >
            <span className="block h-2.5 w-24 animate-pulse rounded bg-[#e8edf7]" />
            <span className="mt-4 block h-7 w-16 animate-pulse rounded bg-[#e8edf7]" />
            <span className="mt-3 block h-2.5 w-32 animate-pulse rounded bg-[#eef2fa]" />
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-line bg-white p-5 shadow-[0_1px_2px_rgba(16,35,61,0.04)] lg:p-6">
        <span className="block h-3 w-48 animate-pulse rounded bg-[#e8edf7]" />
        <span className="mt-4 block h-2.5 w-full animate-pulse rounded bg-[#eef2fa]" />
        <span className="mt-2 block h-2.5 w-5/6 animate-pulse rounded bg-[#eef2fa]" />
        <span className="mt-2 block h-2.5 w-2/3 animate-pulse rounded bg-[#eef2fa]" />
      </div>
      <p className="text-[11.5px] text-muted">
        Cargando proyectos y tareas desde el servidor…
      </p>
    </div>
  );
}

function ProjectDashboardError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="space-y-6">
      <header>
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
          UNIPOLI · Vicerrectoría de I+D+I
        </p>
        <h1 className="mt-2 text-[30px] font-semibold leading-tight tracking-tight text-ink sm:text-[36px]">
          Panel de Proyecto
        </h1>
      </header>

      <section
        role="alert"
        className="rounded-xl border border-red-200 bg-red-50/60 p-8 text-center"
      >
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-red-100 text-red-700">
          <Icon name="alert" className="h-6 w-6" />
        </span>
        <h2 className="mt-4 text-[15px] font-semibold text-ink">
          No se pudieron cargar tus proyectos
        </h2>
        <p className="mx-auto mt-2 max-w-md text-[12.5px] leading-relaxed text-muted">
          Revisa tu conexión e inténtalo de nuevo. Si el problema continúa,
          contacta a la Vicerrectoría de I+D+I.
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 inline-flex h-9 items-center gap-2 rounded-md bg-brand-900 px-3.5 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-800"
        >
          <Icon name="refresh" className="h-4 w-4" />
          Reintentar
        </button>
      </section>
    </div>
  );
}

function ProjectDashboardEmpty({ user }: { user: DashboardUser }) {
  const canRegister = user.role === 'PRINCIPAL_INVESTIGATOR';

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
          UNIPOLI · Vicerrectoría de I+D+I
        </p>
        <h1 className="mt-2 text-[30px] font-semibold leading-tight tracking-tight text-ink sm:text-[36px]">
          Panel de Proyecto
        </h1>
        <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-muted">
          Ciclo de investigación, tareas asignadas, objetivos y evidencia
          documental en una sola vista.
        </p>
      </header>

      <section className="rounded-xl border border-dashed border-line bg-white p-8 text-center shadow-[0_1px_2px_rgba(16,35,61,0.04)] lg:p-12">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-brand-50 text-brand-700">
          <Icon name="folder" className="h-6 w-6" />
        </span>
        <h2 className="mt-4 text-[15px] font-semibold text-ink">
          Aún no tienes proyectos asignados
        </h2>
        <p className="mx-auto mt-2 max-w-md text-[12.5px] leading-relaxed text-muted">
          {canRegister
            ? 'Registra tu primer proyecto para consultar objetivos, hitos, equipo y evidencia documental desde este panel.'
            : 'Cuando el Investigador Principal te añada a un equipo de investigación, aquí verás tus tareas y el expediente del proyecto.'}
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
          {canRegister && (
            <Link
              href="/projects/new"
              className="inline-flex h-9 items-center gap-2 rounded-md bg-brand-900 px-3.5 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-800"
            >
              <Icon name="register" className="h-4 w-4" />
              Registrar proyecto
            </Link>
          )}
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-2.5 py-1 text-[10.5px] font-medium text-muted">
            <Icon name="eye" className="h-3 w-3" />
            Vista filtrada por rol: {ROLE_LABELS[user.role]} (RF-001)
          </span>
        </div>
      </section>
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
  tone: 'amber' | 'brand' | 'emerald';
}) {
  const toneStyles = {
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    brand: 'border-brand-200 bg-brand-50 text-brand-800',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  } as const;

  return (
    <div className={`rounded-lg border px-3 py-2 ${toneStyles[tone]}`}>
      <p className="text-[19px] font-semibold leading-none">{value}</p>
      <p className="mt-1 text-[10px] font-medium uppercase tracking-wide opacity-80">
        {label}
      </p>
    </div>
  );
}

// 🚨 COMPONENTE ACTUALIZADO CON BOTÓN DE SUBIDA
function TaskRow({ 
  task, 
  userName, 
  onUpload, 
  uploading,
  readOnly,
}: { 
  task: DashboardTask; 
  userName: string; 
  onUpload: (id: number, file: File) => void; 
  uploading: boolean; 
  readOnly: boolean;
}) {
  const due = formatDate(task.dueDate);
  const assignee =
    task.assignee === 'me'
      ? `Tú (${firstName(userName)})`
      : task.assigneeName;

  return (
    <li className="flex items-start gap-3 rounded-lg border border-line/80 px-3 py-2.5 transition hover:border-brand-200 hover:bg-[#fafbfe]">
      <span
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
          {task.id} · {assignee}
        </p>
      </div>

      <div className="shrink-0 text-right flex flex-col items-end gap-1.5">
        <p className="text-[10px] text-muted">{due}</p>
        <span
          className={`inline-flex rounded-full border px-2 py-0.5 text-[9.5px] font-semibold ${TASK_STATUS_STYLES[task.status]}`}
        >
          {TASK_STATUS_LABELS[task.status]}
        </span>

        {/* Botón de subir evidencia (solo si es una tarea real, no está completada y el proyecto no está archivado) */}
        {readOnly && task.status !== 'Completed' && task.id.startsWith('MS-') && (
          <span className="mt-1 inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-medium text-amber-800">
            <Icon name="stamp" className="h-3 w-3" />
            Solo lectura
          </span>
        )}
        {!readOnly && task.status !== 'Completed' && task.id.startsWith('MS-') && (
          <div className="mt-1">
            <input
              type="file"
              id={`file-${task.id}`}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onUpload(Number(task.id.replace('MS-', '')), file);
                // Limpiar input para permitir subir el mismo archivo si se requiere
                e.target.value = '';
              }}
              disabled={uploading}
            />
            <label
              htmlFor={`file-${task.id}`}
              className={`cursor-pointer inline-flex items-center gap-1 rounded border border-brand-200 bg-brand-50 px-2 py-1 text-[10px] font-medium text-brand-700 hover:bg-brand-100 transition ${
                uploading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <Icon name="arrowUpRight" className="h-3 w-3" />
              {uploading ? 'Subiendo...' : 'Evidencia'}
            </label>
          </div>
        )}
      </div>
    </li>
  );
}

function DocumentRow({ document }: { document: DashboardDocument }) {
  return (
    <tr className="border-b border-line/70 align-middle transition hover:bg-[#fafbfe]">
      <td className="px-5 py-3">
        <span className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-brand-50 text-brand-700">
            <Icon name="doc" className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[11.5px] font-medium text-ink">
              {document.name}
            </span>
            <span className="block text-[10px] text-muted">
              {document.id} · {document.size}
              {document.mandatoryReview && (
                <span className="ml-1.5 inline-flex rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[9px] font-semibold text-amber-800">
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
        <span className="inline-flex items-center gap-1 rounded-full border border-line bg-[#f8f9fd] px-2 py-0.5 text-[9.5px] font-medium text-muted">
          {document.visibility === 'Shared_with_administration'
            ? 'Equipo + Administración'
            : 'Solo equipo'}
        </span>
      </td>
      <td className="px-5 py-3 text-right">
        <button
          type="button"
          disabled
          title="La descarga se habilita al integrar el repositorio documental (RF-005)"
          className="inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1 text-[10.5px] font-medium text-muted disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Icon name="download" className="h-3.5 w-3.5" />
          Descargar
        </button>
      </td>
    </tr>
  );
}