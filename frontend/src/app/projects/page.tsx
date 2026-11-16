'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import { getApolloClient, MY_PROJECTS_QUERY, type MyProjectSummary } from '@/lib/apollo-client';
import {
  STATUS_LABELS,
  formatDate,
  isInstitutionalRole,
  toPlatformRole,
  type PlatformRole,
} from '@/lib/dashboard';

/** F2-04: acceso a los proyectos propios y su detalle. */
export default function ProjectsPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [role, setRole] = useState<PlatformRole>('STUDENT');
  const [projects, setProjects] = useState<MyProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    if (checking) {
      return;
    }
    let active = true;
    getApolloClient()
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
          setError('No se pudieron cargar tus proyectos.');
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
  }, [checking]);

  return (
    <main className="min-h-screen bg-surface px-4 py-8">
      <div className="mx-auto w-full max-w-5xl">
        <Link
          href="/dashboard"
          className="text-xs font-semibold uppercase tracking-wide text-brand-700 hover:underline"
        >
          ← Volver al panel
        </Link>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-ink">
              Proyectos e hitos
            </h1>
            <p className="mt-1 text-sm text-muted">
              Seguimiento de entregables, equipo y expediente de cada proyecto.
            </p>
          </div>
          {isInstitutionalRole(role) && (
            <Link
              href="/dashboard"
              className="rounded-md border border-line bg-white px-3 py-2 text-xs font-semibold text-ink hover:bg-brand-50"
            >
              Ver tablero institucional
            </Link>
          )}
        </div>

        {loading && (
          <p className="mt-8 text-sm text-muted">Cargando proyectos…</p>
        )}
        {!loading && error && (
          <p className="mt-8 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </p>
        )}
        {!loading && !error && projects.length === 0 && (
          <p className="mt-8 rounded-xl border border-dashed border-line bg-white p-8 text-center text-sm text-muted">
            No tienes proyectos asignados. Si eres Investigador Principal,
            registra una propuesta desde el panel.
          </p>
        )}

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {projects.map((project) => {
            const progress =
              project.milestonesTotal > 0
                ? Math.round(
                    (project.milestonesCompleted / project.milestonesTotal) *
                      100,
                  )
                : 0;
            return (
              <Link
                key={project.projectId}
                href={`/projects/${project.projectId}`}
                className="rounded-xl border border-line bg-white p-5 shadow-sm transition hover:border-brand-300 hover:shadow"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-700">
                    #{project.projectId} ·{' '}
                    {project.callTitle ?? 'Sin convocatoria'}
                  </p>
                  <span className="rounded-full border border-line bg-surface px-2 py-0.5 text-[10px] font-semibold text-ink">
                    {STATUS_LABELS[project.status] ?? project.status}
                  </span>
                </div>
                <h2 className="mt-1 text-base font-semibold text-ink">
                  {project.title}
                </h2>
                <p className="mt-1 text-xs text-muted">
                  {project.piName ?? 'Sin PI'} · {formatDate(project.startDate)} –{' '}
                  {formatDate(project.endDate)}
                </p>
                <div className="mt-3 flex items-center justify-between text-[11px] text-muted">
                  <span>
                    {project.milestonesCompleted}/{project.milestonesTotal}{' '}
                    hitos
                  </span>
                  <span className="font-semibold text-ink">{progress}%</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#e2e7f3]">
                  <div
                    className="h-full rounded-full bg-brand-600"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}
