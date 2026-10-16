'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { authClient } from '@/lib/auth-client';
import {
  getApolloClient,
  graphqlErrorCode,
} from '@/lib/apollo-client';
import {
  PROPOSALS_PENDING_REVIEW_QUERY,
  type ProposalSummary,
} from '@/lib/proposal-evaluation';

const ALLOWED_ROLES = ['COMMITTEE', 'COORDINATOR'];

/**
 * UC-003 paso 1: lista de propuestas en Proposed/Under_Review para el
 * Comité de Evaluación (RF-019). Las filas con conflicto muestran la
 * alerta BR-011 y enlazan al detalle (lectura, sin formulario).
 */
export default function ProposalEvaluationListPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [denied, setDenied] = useState(false);
  const [proposals, setProposals] = useState<ProposalSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      if (!role || !ALLOWED_ROLES.includes(role)) {
        setDenied(true);
        setChecking(false);
        return;
      }
      setChecking(false);
      getApolloClient()
        .query<{ proposalsPendingReview: ProposalSummary[] }>({
          query: PROPOSALS_PENDING_REVIEW_QUERY,
          fetchPolicy: 'network-only',
        })
        .then((result) => {
          if (active) {
            setProposals(result.data?.proposalsPendingReview ?? []);
          }
        })
        .catch((queryError: unknown) => {
          if (active) {
            const code = graphqlErrorCode(queryError);
            setError(
              code === 'FORBIDDEN'
                ? 'No tienes permisos para ver esta lista.'
                : 'No fue posible cargar las propuestas. Intenta de nuevo.',
            );
          }
        });
    });
    return () => {
      active = false;
    };
  }, [router]);

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
            Solo el Comité de Evaluación o la Coordinación pueden revisar
            propuestas (UC-003).
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto w-full max-w-3xl">
        <p className="text-xs font-medium text-blue-700">
          EVALUACIÓN DE PROPUESTAS · UC-003 / RF-019
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-gray-900">
          Propuestas pendientes de revisión
        </h1>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </p>
        )}

        {proposals !== null && proposals.length === 0 && !error && (
          <p className="mt-4 rounded-md border border-gray-200 bg-white px-3 py-4 text-sm text-gray-600">
            No hay propuestas en estado Propuesto o En revisión.
          </p>
        )}

        <ul className="mt-6 space-y-3">
          {(proposals ?? []).map((proposal) => (
            <li
              key={proposal.projectId}
              className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs text-gray-500">
                    Proyecto #{proposal.projectId} · {proposal.status}
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-gray-900">
                    {proposal.title}
                  </h2>
                </div>
                {proposal.hasConflict && (
                  <span className="shrink-0 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
                    Conflicto de interés
                  </span>
                )}
              </div>
              {proposal.matchedSurnames.length > 0 && (
                <p className="mt-2 text-xs text-amber-800">
                  Apellidos coincidentes: {proposal.matchedSurnames.join(', ')}
                  {proposal.conflictStatus
                    ? ` · Alerta ${proposal.conflictStatus}`
                    : ''}
                </p>
              )}
              <Link
                href={`/proposal-evaluation/${proposal.projectId}`}
                className="mt-3 inline-block text-sm font-medium text-blue-700 hover:underline"
              >
                Revisar propuesta →
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
