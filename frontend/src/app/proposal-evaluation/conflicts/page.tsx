'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useToast } from '@/components/ui/toast-provider';
import { authClient } from '@/lib/auth-client';
import {
  getApolloClient,
  graphqlErrorCode,
} from '@/lib/apollo-client';
import {
  PENDING_CONFLICT_REVIEWS_QUERY,
  RESOLVE_CONFLICT_REVIEW_MUTATION,
  type ConflictReview,
} from '@/lib/proposal-evaluation';

const NOTE_MAX = 4000;
const RESOLUTIONS = ['Cleared', 'Confirmed'] as const;

const RESOLUTION_LABELS: Record<string, string> = {
  Cleared: 'Sin conflicto (habilita al evaluador)',
  Confirmed: 'Conflicto confirmado (bloqueo final)',
};

const inputClassName =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:border-blue-600 focus:outline-none';

/**
 * BR-011: cola de alertas de conflicto pendientes para revisión manual
 * del Administrador. Cleared habilita solo a ese par
 * (proyecto, evaluador); Confirmed lo bloquea de forma permanente.
 */
export default function ConflictReviewsPage() {
  const router = useRouter();
  const toast = useToast();
  const [checking, setChecking] = useState(true);
  const [denied, setDenied] = useState(false);
  const [conflicts, setConflicts] = useState<ConflictReview[] | null>(null);
  const [resolution, setResolution] = useState<Record<number, string>>({});
  const [note, setNote] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState<number | null>(null);

  const loadConflicts = useCallback(async () => {
    try {
      const { data } = await getApolloClient().query<{
        pendingConflictReviews: ConflictReview[];
      }>({
        query: PENDING_CONFLICT_REVIEWS_QUERY,
        fetchPolicy: 'network-only',
      });
      setConflicts(data?.pendingConflictReviews ?? []);
    } catch (queryError: unknown) {
      toast.error(
        'No fue posible cargar las alertas. Intenta de nuevo.',
        'No se pudieron cargar las alertas',
      );
      void queryError;
    }
  }, [toast]);

  useEffect(() => {
    let active = true;
    authClient.getSession().then(({ data }) => {
      if (!active) {
        return;
      }
      const role = (data?.user as { role?: string } | undefined)?.role;
      if (!data?.user) {
        router.replace('/login');
        return;
      }
      if (role !== 'ADMINISTRATOR') {
        setDenied(true);
        setChecking(false);
        return;
      }
      setChecking(false);
      void loadConflicts();
    });
    return () => {
      active = false;
    };
  }, [router, loadConflicts]);

  async function handleResolve(
    event: FormEvent<HTMLFormElement>,
    conflictId: number,
  ) {
    event.preventDefault();
    const chosen = resolution[conflictId] ?? 'Cleared';
    const text = (note[conflictId] ?? '').trim();
    if (text.length === 0) {
      toast.error('La nota de resolución es obligatoria.');
      return;
    }
    if (text.length > NOTE_MAX) {
      toast.error(`La nota excede ${NOTE_MAX} caracteres.`);
      return;
    }
    setSubmitting(conflictId);
    try {
      await getApolloClient().mutate({
        mutation: RESOLVE_CONFLICT_REVIEW_MUTATION,
        variables: { input: { conflictId, resolution: chosen, note: text } },
      });
      toast.success(
        `Alerta #${conflictId} resuelta como ${chosen === 'Cleared' ? 'sin conflicto' : 'conflicto confirmado'}.`,
        'Alerta resuelta',
      );
      await loadConflicts();
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
    } finally {
      setSubmitting(null);
    }
  }

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-600">Verificando sesión…</p>
      </main>
    );
  }

  if (denied) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <section className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold text-gray-900">Acceso denegado</h1>
          <p className="mt-2 text-sm text-gray-600">
            Solo un Administrador puede revisar alertas de conflicto (BR-011).
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto w-full max-w-3xl">
        <p className="text-xs font-medium text-blue-700">
          CONFLICTOS DE INTERÉS · BR-011
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-gray-900">
          Alertas pendientes de revisión
        </h1>

        {conflicts !== null && conflicts.length === 0 && (
          <p className="mt-4 rounded-md border border-gray-200 bg-white px-3 py-4 text-sm text-gray-600">
            No hay alertas pendientes.
          </p>
        )}

        <ul className="mt-6 space-y-4">
          {(conflicts ?? []).map((conflict) => (
            <li
              key={conflict.conflictId}
              className="rounded-xl border border-amber-300 bg-white p-5 shadow-sm"
            >
              <p className="text-xs text-gray-500">
                Alerta #{conflict.conflictId} · Proyecto #
                {conflict.projectId}
              </p>
              <h2 className="mt-1 text-lg font-semibold text-gray-900">
                {conflict.projectTitle}
              </h2>
              <p className="mt-1 text-sm text-gray-700">
                Revisor: {conflict.reviewerName} · Apellidos coincidentes:{' '}
                {conflict.matchedSurnames.length > 0
                  ? conflict.matchedSurnames.join(', ')
                  : 'registrados'}
              </p>
              <form
                onSubmit={(event) => handleResolve(event, Number(conflict.conflictId))}
                className="mt-4 space-y-3"
                noValidate
              >
                <fieldset>
                  <legend className="mb-2 block text-sm font-medium text-gray-700">
                    Resolución *
                  </legend>
                  <div className="space-y-2">
                    {RESOLUTIONS.map((value) => (
                      <label
                        key={value}
                        className="flex items-center gap-2 text-sm text-gray-900"
                      >
                        <input
                          type="radio"
                          name={`resolution-${conflict.conflictId}`}
                          value={value}
                          checked={(resolution[Number(conflict.conflictId)] ?? 'Cleared') === value}
                          onChange={() =>
                            setResolution((prev) => ({
                              ...prev,
                              [Number(conflict.conflictId)]: value,
                            }))
                          }
                        />
                        {RESOLUTION_LABELS[value]}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div>
                  <label
                    htmlFor={`note-${conflict.conflictId}`}
                    className="mb-1 block text-sm font-medium text-gray-700"
                  >
                    Nota de resolución *
                  </label>
                  <textarea
                    id={`note-${conflict.conflictId}`}
                    required
                    rows={3}
                    maxLength={NOTE_MAX}
                    value={note[Number(conflict.conflictId)] ?? ''}
                    onChange={(event) =>
                      setNote((prev) => ({
                        ...prev,
                        [Number(conflict.conflictId)]: event.target.value,
                      }))
                    }
                    placeholder="Verificación realizada y fundamento…"
                    className={inputClassName}
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting === Number(conflict.conflictId)}
                  className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting === Number(conflict.conflictId)
                    ? 'Resolviendo…'
                    : 'Resolver alerta'}
                </button>
              </form>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
