'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { AuthedShell } from '@/components/dashboard/authed-shell';
import { Icon } from '@/components/dashboard/icons';
import { MilestonesPanel } from '@/components/projects/milestones-panel';
import { TeamPanel } from '@/components/projects/team-panel';
import { Alert } from '@/components/ui/alert';
import { BackLink, Breadcrumbs } from '@/components/ui/breadcrumbs';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { PageHeader } from '@/components/ui/page-header';
import { ProgressBar } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  STATUS_LABELS,
  formatCurrency,
  formatDate,
  type DashboardUser,
} from '@/lib/dashboard';
import {
  fetchProjectDetail,
  fetchProjectHistory,
  projectErrorMessage,
  type ProjectDetail,
  type ProjectHistoryEntry,
} from '@/lib/projects';
import { fetchTeamMembers, PROJECT_ROLE_LABELS } from '@/lib/teams';

type Tab = 'resumen' | 'equipo' | 'hitos' | 'documentos' | 'historial';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'equipo', label: 'Equipo' },
  { id: 'hitos', label: 'Hitos' },
  { id: 'documentos', label: 'Documentos y productos' },
  { id: 'historial', label: 'Historial' },
];

export default function ProjectDetailPage() {
  return (
    <AuthedShell
      activeId="hitos"
      searchPlaceholder="Buscar por proyecto, investigador o convocatoria…"
    >
      {(user) => <ProjectDetailContent user={user} />}
    </AuthedShell>
  );
}

function ProjectDetailContent({ user }: { user: DashboardUser }) {
  const params = useParams<{ projectId: string }>();
  const projectId = Number(params?.projectId);
  const validProjectId = Number.isInteger(projectId) && projectId > 0;

  const [detail, setDetail] = useState<{
    project: ProjectDetail;
    canManage: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [tab, setTab] = useState<Tab>('resumen');
  const [history, setHistory] = useState<ProjectHistoryEntry[] | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyAttempt, setHistoryAttempt] = useState(0);

  useEffect(() => {
    if (!validProjectId) {
      return;
    }
    let active = true;
    Promise.all([fetchProjectDetail(projectId), fetchTeamMembers(projectId)])
      .then(([project, team]) => {
        if (!active) {
          return;
        }
        setDetail({
          project,
          canManage:
            user.role === 'ADMINISTRATOR' ||
            team.some(
              (member) =>
                member.userId === user.id &&
                member.projectRole === 'Principal_Investigator',
            ),
        });
        setError(null);
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(projectErrorMessage(loadError));
        }
      });
    return () => {
      active = false;
    };
  }, [projectId, user.id, user.role, validProjectId, reloadKey]);

  useEffect(() => {
    if (tab !== 'historial' || !validProjectId || history !== null) {
      return;
    }
    let active = true;
    fetchProjectHistory(projectId)
      .then((rows) => {
        if (active) {
          setHistory(rows);
        }
      })
      .catch((loadError: unknown) => {
        if (active) {
          setHistoryError(projectErrorMessage(loadError));
        }
      });
    return () => {
      active = false;
    };
  }, [tab, projectId, history, validProjectId, historyAttempt]);

  if (!validProjectId) {
    return (
      <div className="space-y-6">
        <BackLink href="/projects">Volver a proyectos</BackLink>
        <ErrorState
          className="min-h-[280px] justify-center bg-white"
          title="El proyecto indicado no es válido"
          description="El enlace no contiene un identificador de proyecto reconocible."
          action={
            <ButtonLink href="/projects" variant="secondary" size="sm">
              Ver mis proyectos
            </ButtonLink>
          }
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <BackLink href="/projects">Volver a proyectos</BackLink>
        <ErrorState
          className="min-h-[280px] justify-center bg-white"
          title="No pudimos cargar el proyecto"
          description={error}
          onRetry={() => {
            setError(null);
            setReloadKey((key) => key + 1);
          }}
          action={
            <ButtonLink href="/projects" variant="secondary" size="sm">
              Ver mis proyectos
            </ButtonLink>
          }
        />
      </div>
    );
  }

  if (!detail) {
    return <ProjectDetailSkeleton />;
  }

  const { project, canManage } = detail;
  const progress =
    project.milestonesTotal > 0
      ? Math.round(
          (project.milestonesCompleted / project.milestonesTotal) * 100,
        )
      : 0;

  return (
    <div className="space-y-5">
      <Breadcrumbs
        items={[
          { label: 'Panel', href: '/dashboard' },
          { label: 'Proyectos', href: '/projects' },
          { label: `#${project.projectId}` },
        ]}
      />

      <PageHeader
        title={project.title}
        description={
          <>
            Proyecto #{project.projectId} ·{' '}
            {project.callTitle ?? 'Sin convocatoria'} ·{' '}
            {project.piName ?? 'Sin investigador principal'}
            <br />
            {formatDate(project.startDate)} – {formatDate(project.endDate)}
          </>
        }
        actions={
          <>
            {project.isConfidential && (
              <span className="rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-[11px] font-medium text-brand-800">
                Confidencial
              </span>
            )}
            <span className="rounded-full border border-line bg-white px-2.5 py-1 text-[11px] font-semibold text-ink">
              {STATUS_LABELS[project.status] ?? project.status}
            </span>
            <ButtonLink
              href={`/projects/${projectId}/documents`}
              size="sm"
              leadingIcon={<Icon name="folder" className="h-4 w-4" />}
            >
              Abrir expediente
            </ButtonLink>
          </>
        }
      />

      <section className="rounded-xl border border-line bg-white p-5">
        <div className="flex items-center justify-between text-xs text-muted">
          <span>Avance por hitos</span>
          <span className="font-semibold tabular-nums text-ink">
            {project.milestonesCompleted}/{project.milestonesTotal} · {progress}%
          </span>
        </div>
        <ProgressBar
          className="mt-2"
          label="Avance por hitos del proyecto"
          value={progress}
        />

        {project.isReadOnly && (
          <Alert tone="warning" className="mt-4" title="Expediente archivado">
            Archivado el{' '}
            {project.archivedAt ? formatDate(project.archivedAt) : '—'}. El
            proyecto es de solo lectura: no admite cambios ni nuevas evidencias.
          </Alert>
        )}
      </section>

      <nav
        role="tablist"
        aria-label="Secciones del proyecto"
        className="flex gap-1 overflow-x-auto rounded-xl border border-line bg-white p-1"
      >
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`tab-${item.id}`}
            aria-selected={tab === item.id}
            aria-controls={`panel-${item.id}`}
            tabIndex={tab === item.id ? 0 : -1}
            onClick={() => setTab(item.id)}
            className={`whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors duration-150 ease-snappy ${
              tab === item.id
                ? 'bg-brand-800 text-white'
                : 'text-muted hover:bg-brand-50 hover:text-ink'
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div
        role="tabpanel"
        id={`panel-${tab}`}
        aria-labelledby={`tab-${tab}`}
        className="animate-fade-in"
      >
        {tab === 'resumen' && (
          <div className="grid gap-5 lg:grid-cols-[1.7fr_1fr]">
            <section className="rounded-xl border border-line bg-white p-5 lg:p-6">
              <h2 className="text-sm font-semibold text-ink">
                Objetivos y alcance
              </h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink/90">
                {project.objectives || 'Sin objetivos registrados.'}
              </p>

              <h3 className="mt-6 text-sm font-semibold text-ink">Equipo</h3>
              {project.team.length === 0 ? (
                <p className="mt-2 rounded-lg border border-line bg-surface-2 px-4 py-3 text-xs text-muted">
                  Sin integrantes registrados todavía.
                </p>
              ) : (
                <ul className="mt-2 divide-y divide-line rounded-lg border border-line">
                  {project.team.map((member) => (
                    <li
                      key={`${member.name}-${member.role}`}
                      className="flex items-center justify-between gap-3 px-4 py-2.5"
                    >
                      <span className="text-sm text-ink">{member.name}</span>
                      <span className="text-xs text-muted">
                        {PROJECT_ROLE_LABELS[
                          member.role as keyof typeof PROJECT_ROLE_LABELS
                        ] ?? member.role}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <aside className="space-y-4">
              <section className="rounded-xl border border-line bg-white p-5">
                <h2 className="text-sm font-semibold text-ink">
                  Datos institucionales
                </h2>
                <dl className="mt-3 space-y-2 text-xs">
                  <Row label="Convocatoria" value={project.callTitle ?? '—'} />
                  <Row
                    label="Presupuesto"
                    value={
                      project.budgetEnabled && project.budgetSpent !== null
                        ? formatCurrency(project.budgetSpent)
                        : 'No habilitado'
                    }
                  />
                  <Row
                    label="Último cambio de estado"
                    value={formatDate(project.statusChangedAt)}
                  />
                  <Row
                    label="Retención programada"
                    value={
                      project.retentionDeleteAt
                        ? formatDate(project.retentionDeleteAt)
                        : 'No definida'
                    }
                  />
                </dl>
              </section>

              <section className="rounded-xl border border-line bg-white p-5">
                <h2 className="text-sm font-semibold text-ink">
                  Banderas de investigación
                </h2>
                <ul className="mt-3 space-y-2 text-xs text-ink">
                  <Flag
                    label="Involucra seres humanos"
                    active={project.researchInvolvesHumans}
                  />
                  <Flag
                    label="Involucra animales"
                    active={project.researchInvolvesAnimals}
                  />
                  <Flag
                    label="Usa datos sensibles"
                    active={project.usesSensitiveData}
                  />
                  <Flag
                    label="Anonimización certificada"
                    active={project.anonymizationCertified}
                  />
                </ul>
              </section>
            </aside>
          </div>
        )}

        {tab === 'equipo' && (
          <TeamPanel
            projectId={projectId}
            canManage={canManage}
            readOnly={project.isReadOnly}
          />
        )}

        {tab === 'hitos' && (
          <MilestonesPanel
            projectId={projectId}
            canManage={canManage}
            currentUserId={user.id}
            readOnly={project.isReadOnly}
          />
        )}

        {tab === 'documentos' && (
          <section className="rounded-xl border border-line bg-white p-5 lg:p-6">
            <h2 className="text-sm font-semibold text-ink">
              Expediente documental, versiones y productos
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
              La carga de evidencia, el control de visibilidad, las versiones de
              propuesta y los productos de investigación se gestionan en el
              expediente del proyecto.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <ButtonLink
                href={`/projects/${projectId}/documents`}
                leadingIcon={<Icon name="folder" className="h-4 w-4" />}
              >
                Abrir expediente
              </ButtonLink>
              <span className="text-xs text-muted">
                {project.milestonesCompleted} de {project.milestonesTotal} hitos
                completados.
              </span>
            </div>
          </section>
        )}

        {tab === 'historial' && (
          <section className="overflow-hidden rounded-xl border border-line bg-white">
            <header className="border-b border-line px-5 py-3">
              <h2 className="text-sm font-semibold text-ink">
                Historial de estados
              </h2>
            </header>

            {historyError && (
              <div className="p-5">
                <ErrorState
                  compact
                  title="No pudimos cargar el historial"
                  description={historyError}
                  onRetry={() => {
                    setHistoryError(null);
                    setHistoryAttempt((attempt) => attempt + 1);
                  }}
                />
              </div>
            )}

            {!historyError && history === null && (
              <div aria-busy="true" className="space-y-4 px-5 py-5">
                <span className="sr-only">Cargando historial…</span>
                {[0, 1, 2].map((index) => (
                  <div key={index} aria-hidden="true" className="space-y-1.5">
                    <Skeleton className="h-3 w-48" />
                    <Skeleton className="h-2.5 w-64 max-w-full" />
                  </div>
                ))}
              </div>
            )}

            {history && history.length === 0 && (
              <EmptyState
                compact
                className="m-5"
                title="Sin transiciones registradas"
                description="El proyecto todavía no registra cambios de estado en su ciclo de vida."
              />
            )}

            {history && history.length > 0 && (
              <ol className="divide-y divide-line">
                {history.map((entry) => (
                  <li key={entry.transitionId} className="px-5 py-4">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-medium text-ink">
                        {STATUS_LABELS[entry.fromStatus] ?? entry.fromStatus}
                      </span>
                      <Icon
                        name="chevronRight"
                        className="h-3 w-3 text-line-strong"
                      />
                      <span className="font-semibold text-brand-800">
                        {STATUS_LABELS[entry.toStatus] ?? entry.toStatus}
                      </span>
                      <span className="ml-auto text-xs text-muted">
                        {formatDate(entry.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      Por {entry.actorName}
                      {entry.justification ? ` · ${entry.justification}` : ''}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </section>
        )}
      </div>

      <p className="text-xs">
        <Link
          href="/projects"
          className="rounded font-medium text-muted transition-colors duration-150 hover:text-brand-700"
        >
          ← Volver a la lista de proyectos
        </Link>
      </p>
    </div>
  );
}

function ProjectDetailSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true">
      <span className="sr-only">Cargando proyecto…</span>
      <Skeleton className="h-3 w-40" />
      <div className="space-y-2">
        <Skeleton className="h-7 w-3/4 max-w-lg" />
        <Skeleton className="h-3 w-2/3 max-w-md" />
      </div>
      <div className="rounded-xl border border-line bg-white p-5">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="mt-3 h-2 w-full rounded-full" />
      </div>
      <div className="flex gap-1 rounded-xl border border-line bg-white p-1">
        {[0, 1, 2, 3, 4].map((index) => (
          <Skeleton key={index} className="h-8 w-24 rounded-lg" />
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-[1.7fr_1fr]">
        <div className="rounded-xl border border-line bg-white p-5">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-4 h-3 w-full" />
          <Skeleton className="mt-2 h-3 w-5/6" />
          <Skeleton className="mt-2 h-3 w-2/3" />
        </div>
        <div className="rounded-xl border border-line bg-white p-5">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="mt-4 h-3 w-full" />
          <Skeleton className="mt-2 h-3 w-full" />
          <Skeleton className="mt-2 h-3 w-3/4" />
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium text-ink">{value}</dd>
    </div>
  );
}

function Flag({ label, active }: { label: string; active: boolean }) {
  return (
    <li className="flex items-center justify-between gap-3">
      <span>{label}</span>
      <span
        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
          active
            ? 'bg-warning-soft text-warning'
            : 'bg-surface-2 text-muted'
        }`}
      >
        {active ? 'Sí' : 'No'}
      </span>
    </li>
  );
}
