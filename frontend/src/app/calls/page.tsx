'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
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
  CALL_STATUS_LABELS,
  effectiveStatus,
  fetchCalls,
  formatCallDate,
  type Call,
} from '@/lib/calls';

/**
 * F1-09 / RF-018: listado de convocatorias institucionales.
 * Muestra las vigentes (con cupo restante) y el historial de cerradas.
 */
export default function CallsPage() {
  return (
    <AuthedShell
      activeId="convocatorias"
      searchPlaceholder="Buscar convocatorias por nombre o vigencia…"
    >
      {(user) => <CallsContent isAdmin={user.role === 'ADMINISTRATOR'} />}
    </AuthedShell>
  );
}

function CallsContent({ isAdmin }: { isAdmin: boolean }) {
  const [calls, setCalls] = useState<Call[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    fetchCalls()
      .then((result) => {
        if (active) {
          setCalls(result);
        }
      })
      .catch((loadError: unknown) => {
        if (active) {
          setCalls(null);
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'No pudimos cargar las convocatorias.',
          );
        }
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const { open, closed } = useMemo(() => {
    const now = new Date();
    return {
      open: (calls ?? []).filter(
        (call) => effectiveStatus(call, now) === 'OPEN',
      ),
      closed: (calls ?? []).filter(
        (call) => effectiveStatus(call, now) !== 'OPEN',
      ),
    };
  }, [calls]);

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: 'Panel', href: '/dashboard' },
          { label: 'Convocatorias' },
        ]}
      />

      <PageHeader
        title="Convocatorias de investigación"
        description="Consulta los fondos disponibles, su fecha límite y los cupos restantes antes de postular tu propuesta."
        actions={
          isAdmin ? (
            <ButtonLink
              href="/admin/calls"
              size="sm"
              leadingIcon={<Icon name="config" className="h-4 w-4" />}
            >
              Gestionar convocatorias
            </ButtonLink>
          ) : undefined
        }
      />

      {error && (
        <ErrorState
          className="min-h-[280px] justify-center bg-white"
          title="No pudimos cargar las convocatorias"
          description={error}
          onRetry={() => {
            setError(null);
            setCalls(null);
            setReloadKey((key) => key + 1);
          }}
        />
      )}

      {!error && calls === null && <CallsSkeleton />}

      {!error && calls !== null && (
        <>
          <section>
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-sm font-semibold text-ink">
                Convocatorias abiertas
              </h2>
              <span className="text-xs text-muted" aria-live="polite">
                {open.length} {open.length === 1 ? 'vigente' : 'vigentes'}
              </span>
            </div>

            {open.length === 0 ? (
              <EmptyState
                className="mt-3 bg-white"
                icon={<Icon name="calls" className="h-5 w-5" />}
                title="No hay convocatorias abiertas"
                description="Cuando la Vicerrectoría publique una nueva convocatoria, aparecerá aquí con su fecha límite y cupo disponible."
              />
            ) : (
              <ul className="mt-3 grid gap-4 lg:grid-cols-2">
                {open.map((call) => {
                  const remaining = call.remainingSlots;
                  const tight = remaining <= 2;

                  return (
                    <li
                      key={call.callId}
                      className="flex flex-col rounded-xl border border-line bg-white p-5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <h3 className="min-w-0 text-base font-semibold leading-snug text-ink">
                          {call.title}
                        </h3>
                        <span className="shrink-0 rounded-full border border-success-line bg-success-soft px-2.5 py-1 text-[10.5px] font-semibold text-success">
                          {CALL_STATUS_LABELS.OPEN}
                        </span>
                      </div>

                      <p className="mt-1.5 line-clamp-3 text-[12.5px] leading-relaxed text-muted">
                        {call.description}
                      </p>

                      <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <dt className="text-[10.5px] uppercase tracking-wide text-muted">
                            Fecha límite
                          </dt>
                          <dd className="mt-0.5 font-medium text-ink">
                            {formatCallDate(call.deadline)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[10.5px] uppercase tracking-wide text-muted">
                            Postulaciones
                          </dt>
                          <dd className="mt-0.5 font-medium tabular-nums text-ink">
                            {call.applicationCount} de {call.applicationCap}
                          </dd>
                        </div>
                      </dl>

                      <div className="mt-auto pt-4">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-muted">Cupos restantes</span>
                          <strong
                            className={`font-semibold tabular-nums ${
                              tight ? 'text-warning' : 'text-ink'
                            }`}
                          >
                            {remaining}
                          </strong>
                        </div>
                        <ProgressBar
                          className="mt-1.5"
                          label={`Cupo ocupado de ${call.title}`}
                          size="sm"
                          tone={tight ? 'warning' : 'brand'}
                          value={call.applicationCount}
                          max={call.applicationCap}
                        />
                      </div>

                      <Link
                        href={`/calls/${call.callId}`}
                        className="group mt-4 inline-flex items-center gap-1 self-start rounded text-[13px] font-semibold text-brand-700 transition-colors duration-150 hover:text-brand-800"
                      >
                        Ver convocatoria y postular
                        <Icon
                          name="chevronRight"
                          className="h-3.5 w-3.5 transition-transform duration-150 ease-snappy group-hover:translate-x-0.5"
                        />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {closed.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-ink">
                Convocatorias cerradas
              </h2>
              <ul className="mt-3 divide-y divide-line overflow-hidden rounded-xl border border-line bg-white">
                {closed.map((call) => (
                  <li
                    key={call.callId}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-ink">
                        {call.title}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted">
                        Cierre: {formatCallDate(call.deadline)} ·{' '}
                        {call.applicationCount} de {call.applicationCap}{' '}
                        postulaciones
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="rounded-full border border-line bg-surface-2 px-2.5 py-1 text-[10.5px] font-medium text-muted">
                        {effectiveStatus(call) === 'DRAFT'
                          ? CALL_STATUS_LABELS.DRAFT
                          : CALL_STATUS_LABELS.CLOSED}
                      </span>
                      <Link
                        href={`/calls/${call.callId}`}
                        className="rounded text-xs font-semibold text-brand-700 transition-colors duration-150 hover:text-brand-800 hover:underline"
                      >
                        Ver detalle
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function CallsSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <span className="sr-only">Cargando convocatorias…</span>
      <div className="space-y-3">
        <Skeleton className="h-4 w-40" />
        <div className="grid gap-4 lg:grid-cols-2">
          {[0, 1].map((index) => (
            <div
              key={index}
              aria-hidden="true"
              className="rounded-xl border border-line bg-white p-5"
            >
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="mt-3 h-3 w-full" />
              <Skeleton className="mt-2 h-3 w-5/6" />
              <Skeleton className="mt-5 h-2 w-full rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
