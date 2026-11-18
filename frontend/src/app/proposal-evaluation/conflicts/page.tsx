'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { AuthedShell } from '@/components/dashboard/authed-shell';
import { Icon } from '@/components/dashboard/icons';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Textarea } from '@/components/ui/field';
import { ConfirmDialog } from '@/components/ui/modal';
import { NoAccess } from '@/components/ui/no-access';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast-provider';
import type { DashboardUser } from '@/lib/dashboard';
import { getApolloClient, graphqlErrorCode } from '@/lib/apollo-client';
import {
  PENDING_CONFLICT_REVIEWS_QUERY,
  RESOLVE_CONFLICT_REVIEW_MUTATION,
  type ConflictReview,
} from '@/lib/proposal-evaluation';

const NOTE_MAX = 4000;
const RESOLUTIONS = ['Cleared', 'Confirmed'] as const;

const RESOLUTION_LABELS: Record<string, string> = {
  Cleared: 'Sin conflicto · habilita al evaluador',
  Confirmed: 'Conflicto confirmado · bloqueo definitivo',
};

const RESOLUTION_HELP: Record<string, string> = {
  Cleared:
    'La coincidencia de apellidos no representa un conflicto. El evaluador podrá dictaminar este proyecto.',
  Confirmed:
    'Existe un conflicto real. El bloqueo es permanente y no puede revertirse desde esta pantalla.',
};

/**
 * BR-011: cola de alertas de conflicto pendientes para revisión manual
 * del Administrador. Cleared habilita solo a ese par
 * (proyecto, evaluador); Confirmed lo bloquea de forma permanente.
 */
export default function ConflictReviewsPage() {
  return (
    <AuthedShell
      activeId="conflictos"
      searchPlaceholder="Buscar alertas por proyecto o evaluador…"
    >
      {(user) => <ConflictReviewsContent user={user} />}
    </AuthedShell>
  );
}

function ConflictReviewsContent({ user }: { user: DashboardUser }) {
  const toast = useToast();
  const canReview = user.role === 'ADMINISTRATOR';

  const [conflicts, setConflicts] = useState<ConflictReview[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [resolution, setResolution] = useState<Record<number, string>>({});
  const [note, setNote] = useState<Record<number, string>>({});
  const [noteErrors, setNoteErrors] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState<number | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<{
    conflictId: number;
    note: string;
  } | null>(null);

  useEffect(() => {
    if (!canReview) {
      return;
    }
    let active = true;
    getApolloClient()
      .query<{ pendingConflictReviews: ConflictReview[] }>({
        query: PENDING_CONFLICT_REVIEWS_QUERY,
        fetchPolicy: 'network-only',
      })
      .then(({ data }) => {
        if (active) {
          setConflicts(data?.pendingConflictReviews ?? []);
          setLoadError(null);
        }
      })
      .catch((queryError: unknown) => {
        if (active) {
          setConflicts(null);
          setLoadError(
            graphqlErrorCode(queryError) === 'FORBIDDEN'
              ? 'Tu cuenta no tiene permisos para revisar alertas de conflicto.'
              : 'No pudimos cargar las alertas pendientes.',
          );
        }
      });
    return () => {
      active = false;
    };
  }, [canReview, reloadKey]);

  if (!canReview) {
    return (
      <NoAccess
        title="Revisión reservada a la Administración"
        description="Solo un Administrador puede resolver alertas de conflicto de interés. Si crees que es un error, contacta a la Vicerrectoría de I+D+I."
      />
    );
  }

  async function resolveConflict(
    conflictId: number,
    chosen: string,
    text: string,
  ) {
    setSubmitting(conflictId);
    try {
      await getApolloClient().mutate({
        mutation: RESOLVE_CONFLICT_REVIEW_MUTATION,
        variables: { input: { conflictId, resolution: chosen, note: text } },
      });
      toast.success(
        `Alerta #${conflictId} resuelta como ${
          chosen === 'Cleared' ? 'sin conflicto' : 'conflicto confirmado'
        }.`,
        'Alerta resuelta',
      );
      setPendingConfirm(null);
      setNote((current) => ({ ...current, [conflictId]: '' }));
      setNoteErrors((current) => ({ ...current, [conflictId]: '' }));
      setReloadKey((key) => key + 1);
    } catch (submitError: unknown) {
      const code = graphqlErrorCode(submitError);
      toast.error(
        code === 'INVALID_STATE'
          ? 'La alerta ya fue resuelta por otro administrador.'
          : code === 'NOT_FOUND'
            ? 'La alerta no existe.'
            : 'No fue posible resolver la alerta. Intenta de nuevo.',
        'No se pudo resolver la alerta',
      );
      setPendingConfirm(null);
    } finally {
      setSubmitting(null);
    }
  }

  function handleSubmit(
    event: FormEvent<HTMLFormElement>,
    conflictId: number,
  ) {
    event.preventDefault();
    const chosen = resolution[conflictId] ?? 'Cleared';
    const text = (note[conflictId] ?? '').trim();

    if (text.length === 0) {
      setNoteErrors((current) => ({
        ...current,
        [conflictId]: 'Describe la verificación realizada antes de resolver.',
      }));
      document.getElementById(`note-${conflictId}`)?.focus();
      return;
    }
    if (text.length > NOTE_MAX) {
      setNoteErrors((current) => ({
        ...current,
        [conflictId]: `La nota no puede exceder ${NOTE_MAX} caracteres.`,
      }));
      document.getElementById(`note-${conflictId}`)?.focus();
      return;
    }

    if (chosen === 'Confirmed') {
      setPendingConfirm({ conflictId, note: text });
      return;
    }
    void resolveConflict(conflictId, chosen, text);
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: 'Panel', href: '/dashboard' },
          { label: 'Alertas de conflicto' },
        ]}
      />

      <PageHeader
        title="Alertas de conflicto pendientes"
        description="Coincidencias de apellidos entre evaluadores y proyectos que requieren revisión manual antes del dictamen."
      />

      {loadError && (
        <ErrorState
          className="min-h-[280px] justify-center bg-white"
          title="No pudimos cargar las alertas"
          description={loadError}
          onRetry={() => {
            setLoadError(null);
            setConflicts(null);
            setReloadKey((key) => key + 1);
          }}
        />
      )}

      {!loadError && conflicts === null && <ConflictsSkeleton />}

      {!loadError && conflicts !== null && conflicts.length === 0 && (
        <EmptyState
          className="bg-white px-6 py-12"
          icon={<Icon name="shield" className="h-5 w-5" />}
          title="No hay alertas pendientes"
          description="Todas las coincidencias detectadas ya fueron resueltas. Las nuevas alertas aparecerán aquí automáticamente."
        />
      )}

      {!loadError && conflicts !== null && conflicts.length > 0 && (
        <ul className="space-y-4">
          {conflicts.map((conflict) => {
            const conflictId = Number(conflict.conflictId);
            const chosen = resolution[conflictId] ?? 'Cleared';
            const busy = submitting === conflictId;

            return (
              <li
                key={conflict.conflictId}
                className="rounded-xl border border-warning-line bg-white p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
                      Alerta #{conflict.conflictId} · Proyecto #{conflict.projectId}
                    </p>
                    <h2 className="mt-1 text-base font-semibold leading-snug text-ink">
                      {conflict.projectTitle}
                    </h2>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-warning-line bg-warning-soft px-2.5 py-1 text-[10.5px] font-semibold text-warning">
                    <Icon name="alert" className="h-3 w-3" />
                    Revisión manual
                  </span>
                </div>

                <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                  <div>
                    <dt className="text-muted">Evaluador</dt>
                    <dd className="font-medium text-ink">{conflict.reviewerName}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Apellidos coincidentes</dt>
                    <dd className="font-medium text-ink">
                      {conflict.matchedSurnames.length > 0
                        ? conflict.matchedSurnames.join(', ')
                        : 'Registrados'}
                    </dd>
                  </div>
                </dl>

                <form
                  onSubmit={(event) => handleSubmit(event, conflictId)}
                  className="mt-4 space-y-4 border-t border-line pt-4"
                  noValidate
                >
                  <fieldset>
                    <legend className="mb-2 text-[13px] font-medium text-ink">
                      Resolución
                    </legend>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {RESOLUTIONS.map((value) => {
                        const selected = chosen === value;
                        return (
                          <label
                            key={value}
                            className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 transition-colors duration-150 ${
                              selected
                                ? 'border-brand-400 bg-brand-50'
                                : 'border-line bg-white hover:border-brand-200'
                            }`}
                          >
                            <input
                              type="radio"
                              name={`resolution-${conflictId}`}
                              value={value}
                              className="mt-0.5 accent-brand-700"
                              checked={selected}
                              onChange={() =>
                                setResolution((current) => ({
                                  ...current,
                                  [conflictId]: value,
                                }))
                              }
                            />
                            <span className="min-w-0">
                              <span className="block text-[12.5px] font-medium text-ink">
                                {RESOLUTION_LABELS[value]}
                              </span>
                              <span className="mt-0.5 block text-[11px] leading-snug text-muted">
                                {RESOLUTION_HELP[value]}
                              </span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>

                  <Textarea
                    id={`note-${conflictId}`}
                    label="Nota de resolución"
                    required
                    rows={3}
                    maxLength={NOTE_MAX}
                    value={note[conflictId] ?? ''}
                    error={noteErrors[conflictId] || undefined}
                    hint="Queda registrada en la bitácora de auditoría."
                    onChange={(event) => {
                      const value = event.target.value;
                      setNote((current) => ({ ...current, [conflictId]: value }));
                      setNoteErrors((current) => ({
                        ...current,
                        [conflictId]: '',
                      }));
                    }}
                    placeholder="Verificación realizada y fundamento…"
                  />

                  <div className="flex justify-end">
                    <Button type="submit" loading={busy} size="sm">
                      {busy ? 'Resolviendo…' : 'Resolver alerta'}
                    </Button>
                  </div>
                </form>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={pendingConfirm !== null}
        onClose={() => setPendingConfirm(null)}
        onConfirm={() => {
          if (!pendingConfirm) {
            return;
          }
          void resolveConflict(
            pendingConfirm.conflictId,
            'Confirmed',
            pendingConfirm.note,
          );
        }}
        title="Confirmar conflicto de interés"
        description={
          <>
            El evaluador quedará bloqueado de forma permanente para este
            proyecto. Esta acción no se puede deshacer. La decisión y su nota
            quedarán en la bitácora de auditoría.
          </>
        }
        confirmLabel="Sí, confirmar conflicto"
        cancelLabel="Revisar de nuevo"
        loading={submitting !== null}
      />
    </div>
  );
}

function ConflictsSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <span className="sr-only">Cargando alertas de conflicto…</span>
      {[0, 1].map((index) => (
        <div
          key={index}
          aria-hidden="true"
          className="rounded-xl border border-line bg-white p-5"
        >
          <Skeleton className="h-2.5 w-44" />
          <Skeleton className="mt-2 h-4 w-2/3" />
          <Skeleton className="mt-4 h-16 w-full rounded-lg" />
          <Skeleton className="mt-3 h-20 w-full rounded-lg" />
        </div>
      ))}
    </div>
  );
}
