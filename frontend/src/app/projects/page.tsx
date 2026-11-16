'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AuthedShell } from '@/components/dashboard/authed-shell';
import { Icon } from '@/components/dashboard/icons';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { PageHeader } from '@/components/ui/page-header';
import { ProgressBar } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  STATUS_LABELS,
  formatDate,
  isInstitutionalRole,
  type DashboardUser,
} from '@/lib/dashboard';
import {
  getApolloClient,
  MY_PROJECTS_QUERY,
  type MyProjectSummary,
} from '@/lib/apollo-client';

/** F2-04: acceso a los proyectos propios y su detalle. */
export default function ProjectsPage() {
  return (
    <AuthedShell
      activeId="hitos"
      searchPlaceholder="Buscar por proyecto, investigador o convocatoria…"
    >
      {(user) => <ProjectsContent user={user} />}
    </AuthedShell>
  );
}

function ProjectsContent({ user }: { user: DashboardUser }) {
  const [projects, setProjects] = useState<MyProjectSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
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
          setProjects(null);
          setError('No pudimos cargar tus proyectos.');
        }
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[{ label: 'Panel', href: '/dashboard' }, { label: 'Proyectos' }]}
      />

      <PageHeader
        title="Proyectos e hitos"
        description="Seguimiento de entregables, equipo y expediente de cada proyecto."
        actions={
          isInstitutionalRole(user.role) ? (
            <ButtonLink href="/dashboard" variant="secondary" size="sm">
              Ver tablero institucional
            </ButtonLink>
          ) : (
            <ButtonLink
              href="/projects/new"
              size="sm"
              leadingIcon={<Icon name="register" className="h-4 w-4" />}
            >
              Registrar proyecto
            </ButtonLink>
          )
        }
      />

      {error && (
        <ErrorState
          className="min-h-[280px] justify-center bg-white"
          title="No pudimos cargar tus proyectos"
          description={error}
          onRetry={() => {
            setError(null);
            setProjects(null);
            setReloadKey((key) => key + 1);
          }}
        />
      )}

      {!error && projects === null && <ProjectsSkeleton />}

      {!error && projects !== null && projects.length === 0 && (
        <EmptyState
          className="bg-white px-6 py-12"
          icon={<Icon name="folder" className="h-5 w-5" />}
          title="No tienes proyectos asignados"
          description={
            user.role === 'PRINCIPAL_INVESTIGATOR'
              ? 'Registra tu primera propuesta para dar seguimiento a sus hitos, equipo y expediente.'
              : 'Cuando el Investigador Principal te añada a un equipo, tus proyectos aparecerán aquí.'
          }
          action={
            user.role === 'PRINCIPAL_INVESTIGATOR' ? (
              <ButtonLink href="/projects/new">Registrar proyecto</ButtonLink>
            ) : undefined
          }
        />
      )}

      {!error && projects !== null && projects.length > 0 && (
        <ul className="grid gap-4 md:grid-cols-2">
          {projects.map((project) => {
            const progress =
              project.milestonesTotal > 0
                ? Math.round(
                    (project.milestonesCompleted / project.milestonesTotal) *
                      100,
                  )
                : 0;

            return (
              <li key={project.projectId}>
                <Link
                  href={`/projects/${project.projectId}`}
                  className="group flex h-full flex-col rounded-xl border border-line bg-white p-5 transition-[border-color,box-shadow] duration-150 ease-snappy hover:border-brand-300 hover:shadow-card focus-visible:outline-brand-400"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
                      Proyecto #{project.projectId}
                    </p>
                    <span className="shrink-0 rounded-full border border-line bg-surface-2 px-2 py-0.5 text-[10px] font-semibold text-ink">
                      {STATUS_LABELS[project.status] ?? project.status}
                    </span>
                  </div>

                  <h2 className="mt-1.5 text-base font-semibold leading-snug text-ink transition-colors duration-150 group-hover:text-brand-800">
                    {project.title}
                  </h2>
                  <p className="mt-1 text-xs text-muted">
                    {project.callTitle ?? 'Sin convocatoria'} ·{' '}
                    {project.piName ?? 'Sin PI'}
                  </p>

                  <p className="mt-3 text-[11px] text-muted">
                    {formatDate(project.startDate)} – {formatDate(project.endDate)}
                  </p>

                  <div className="mt-auto pt-4">
                    <div className="flex items-center justify-between text-[11px] text-muted">
                      <span>
                        {project.milestonesCompleted}/{project.milestonesTotal}{' '}
                        hitos completados
                      </span>
                      <span className="font-semibold tabular-nums text-ink">
                        {progress}%
                      </span>
                    </div>
                    <ProgressBar
                      className="mt-1.5"
                      label={`Avance de ${project.title}`}
                      size="sm"
                      value={progress}
                    />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ProjectsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2" aria-busy="true">
      <span className="sr-only">Cargando proyectos…</span>
      {[0, 1, 2, 3].map((index) => (
        <div
          key={index}
          aria-hidden="true"
          className="rounded-xl border border-line bg-white p-5"
        >
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <Skeleton className="mt-3 h-4 w-4/5" />
          <Skeleton className="mt-2 h-3 w-2/3" />
          <Skeleton className="mt-6 h-2 w-full rounded-full" />
        </div>
      ))}
    </div>
  );
}
