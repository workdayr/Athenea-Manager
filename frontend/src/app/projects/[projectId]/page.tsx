'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { MilestonesPanel } from '@/components/projects/milestones-panel';
import { TeamPanel } from '@/components/projects/team-panel';
import { Icon } from '@/components/dashboard/icons';
import { authClient } from '@/lib/auth-client';
import {
  STATUS_LABELS,
  formatCurrency,
  formatDate,
  toPlatformRole,
  type PlatformRole,
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
  const params = useParams<{ projectId: string }>();
  const router = useRouter();
  const projectId = Number(params?.projectId);
  const validProjectId = Number.isInteger(projectId) && projectId > 0;

  const [checking, setChecking] = useState(true);
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState<PlatformRole>('STUDENT');
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('resumen');
  const [canManage, setCanManage] = useState(false);
  const [history, setHistory] = useState<ProjectHistoryEntry[] | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    authClient
      .getSession()
      .then(({ data }) => {
        if (!active) {
          return;
        }
        if (!data?.user) {
          router.replace('/login');
          return;
        }
        setUserId(data.user.id);
        setRole(toPlatformRole((data.user as { role?: unknown }).role));
        setChecking(false);
      })
      .catch(() => {
        if (active) {
          router.replace('/login');
        }
      });
    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    if (checking || !validProjectId) {
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    Promise.all([fetchProjectDetail(projectId), fetchTeamMembers(projectId)])
      .then(([detail, team]) => {
        if (!active) {
          return;
        }
        setProject(detail);
        setCanManage(
          role === 'ADMINISTRATOR' ||
            team.some(
              (member) =>
                member.userId === userId &&
                member.projectRole === 'Principal_Investigator',
            ),
        );
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(projectErrorMessage(loadError));
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [checking, projectId, role, userId, validProjectId]);

  useEffect(() => {
    if (tab !== 'historial' || !validProjectId || history !== null) {
      return;
    }
    let active = true;
    setHistoryError(null);
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
  }, [tab, projectId, history, validProjectId]);

  if (checking || loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-surface">
        <p className="text-sm text-muted">Cargando proyecto…</p>
      </main>
    );
  }

  if (!validProjectId || error || !project) {
    return (
      <main className="min-h-screen bg-surface px-4 py-10">
        <div className="mx-auto max-w-3xl rounded-xl border border-red-200 bg-red-50 p-6">
          <p className="text-sm text-red-700">
            {!validProjectId
              ? 'El proyecto indicado no es valido.'
              : (error ?? 'No se pudo cargar el proyecto.')}
          </p>
          <Link
            href="/dashboard"
            className="mt-3 inline-block text-xs font-semibold text-red-800 underline"
          >
            Volver al panel
          </Link>
        </div>
      </main>
    );
  }

  const progress =
    project.milestonesTotal > 0
      ? Math.round(
          (project.milestonesCompleted / project.milestonesTotal) * 100,
        )
      : 0;

  return (
    <main className="min-h-screen bg-surface px-4 py-8">
      <div className="mx-auto w-full max-w-6xl">
        <Link
          href="/dashboard"
          className="text-xs font-semibold uppercase tracking-wide text-brand-700 hover:underline"
        >
          ← Volver al panel
        </Link>

        <header className="mt-3 rounded-2xl border border-line bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-700">
                Proyecto #{project.projectId} · {project.callTitle ?? 'Sin convocatoria'}
              </p>
              <h1 className="mt-1 text-2xl font-semibold text-ink">
                {project.title}
              </h1>
              <p className="mt-1 text-sm text-muted">
                {project.piName ?? 'Sin investigador principal'} ·{' '}
                {formatDate(project.startDate)} – {formatDate(project.endDate)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {project.isConfidential && (
                <span className="rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-800">
                  Confidencial (BR-007)
                </span>
              )}
              <span className="rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-semibold text-ink">
                {STATUS_LABELS[project.status] ?? project.status}
              </span>
            </div>
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between text-xs text-muted">
              <span>Avance por hitos</span>
              <span className="font-semibold text-ink">
                {project.milestonesCompleted}/{project.milestonesTotal} ·{' '}
                {progress}%
              </span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#e2e7f3]">
              <div
                className="h-full rounded-full bg-brand-600"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {project.isReadOnly && (
            <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              Expediente archivado el{' '}
              {project.archivedAt ? formatDate(project.archivedAt) : '—'}. El
              proyecto es de solo lectura (RF-020).
            </p>
          )}
        </header>

        <nav
          className="mt-5 flex gap-1 overflow-x-auto rounded-xl border border-line bg-white p-1 shadow-sm"
          aria-label="Secciones del proyecto"
        >
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-current={tab === item.id ? 'page' : undefined}
              onClick={() => setTab(item.id)}
              className={`whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
                tab === item.id
                  ? 'bg-brand-800 text-white'
                  : 'text-muted hover:bg-brand-50 hover:text-ink'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="mt-5">
          {tab === 'resumen' && (
            <div className="grid gap-5 lg:grid-cols-[1.7fr_1fr]">
              <section className="rounded-xl border border-line bg-white p-6 shadow-sm">
                <h2 className="text-sm font-semibold text-ink">
                  Objetivos y alcance
                </h2>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink/90">
                  {project.objectives || 'Sin objetivos registrados.'}
                </p>

                <h3 className="mt-6 text-sm font-semibold text-ink">
                  Equipo
                </h3>
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
                  {project.team.length === 0 && (
                    <li className="px-4 py-4 text-sm text-muted">
                      Sin integrantes registrados.
                    </li>
                  )}
                </ul>
              </section>

              <aside className="space-y-4">
                <section className="rounded-xl border border-line bg-white p-5 shadow-sm">
                  <h2 className="text-sm font-semibold text-ink">
                    Datos institucionales
                  </h2>
                  <dl className="mt-3 space-y-2 text-xs">
                    <Row label="Convocatoria" value={project.callTitle ?? '—'} />
                    <Row
                      label="Presupuesto"
                      value={
                        project.budgetEnabled &&
                        project.budgetSpent !== null
                          ? formatCurrency(project.budgetSpent)
                          : 'No habilitado'
                      }
                    />
                    <Row
                      label="Ultimo cambio de estado"
                      value={formatDate(project.statusChangedAt)}
                    />
                    <Row
                      label="Retencion programada"
                      value={
                        project.retentionDeleteAt
                          ? formatDate(project.retentionDeleteAt)
                          : 'No definida'
                      }
                    />
                  </dl>
                </section>

                <section className="rounded-xl border border-line bg-white p-5 shadow-sm">
                  <h2 className="text-sm font-semibold text-ink">
                    Banderas de investigacion
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
                      label="Anonimizacion certificada (BR-012)"
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
              currentUserId={userId}
              readOnly={project.isReadOnly}
            />
          )}

          {tab === 'documentos' && (
            <section className="rounded-xl border border-line bg-white p-6 shadow-sm">
              <h2 className="text-sm font-semibold text-ink">
                Expediente documental, versiones y productos
              </h2>
              <p className="mt-2 text-sm text-muted">
                La carga de evidencia, el control de visibilidad, las versiones
                de propuesta y los productos de investigacion se gestionan en
                el expediente del proyecto.
              </p>
              <Link
                href={`/projects/${projectId}/documents`}
                className="mt-4 inline-flex items-center gap-2 rounded-md bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800"
              >
                <Icon name="folder" className="h-4 w-4" />
                Abrir expediente
              </Link>
              <p className="mt-3 text-xs text-muted">
                {project.milestonesCompleted} de {project.milestonesTotal} hitos
                completados.
              </p>
            </section>
          )}

          {tab === 'historial' && (
            <section className="overflow-hidden rounded-xl border border-line bg-white shadow-sm">
              <header className="border-b border-line px-5 py-3">
                <h2 className="text-sm font-semibold text-ink">
                  Historial de estados (RF-003)
                </h2>
              </header>
              {historyError && (
                <p className="px-5 py-6 text-sm text-red-700">{historyError}</p>
              )}
              {!historyError && history === null && (
                <p className="px-5 py-6 text-sm text-muted">
                  Cargando historial…
                </p>
              )}
              {history && history.length === 0 && (
                <p className="px-5 py-8 text-center text-sm text-muted">
                  El proyecto aun no registra transiciones de estado.
                </p>
              )}
              {history && history.length > 0 && (
                <ol className="divide-y divide-line">
                  {history.map((entry) => (
                    <li key={entry.transitionId} className="px-5 py-4">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-medium text-ink">
                          {STATUS_LABELS[entry.fromStatus] ?? entry.fromStatus}
                        </span>
                        <span className="text-muted">→</span>
                        <span className="font-semibold text-brand-800">
                          {STATUS_LABELS[entry.toStatus] ?? entry.toStatus}
                        </span>
                        <span className="ml-auto text-xs text-muted">
                          {formatDate(entry.createdAt)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted">
                        Por {entry.actorName}
                        {entry.justification
                          ? ` · ${entry.justification}`
                          : ''}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          )}
        </div>
      </div>
    </main>
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
            ? 'bg-amber-50 text-amber-800'
            : 'bg-surface text-muted'
        }`}
      >
        {active ? 'Sí' : 'No'}
      </span>
    </li>
  );
}
