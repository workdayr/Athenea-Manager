'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AuthedShell } from '@/components/dashboard/authed-shell';
import { Icon } from '@/components/dashboard/icons';
import { Alert } from '@/components/ui/alert';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { NoAccess } from '@/components/ui/no-access';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { STATUS_LABELS } from '@/lib/dashboard';
import { getApolloClient, graphqlErrorCode } from '@/lib/apollo-client';
import {
  PROPOSALS_PENDING_REVIEW_QUERY,
  type ProposalSummary,
} from '@/lib/proposal-evaluation';

const ALLOWED_ROLES = ['COMMITTEE', 'COORDINATOR'];

/**
 * Paso 1: lista de propuestas en Proposed/Under_Review para el
 * Comité de Evaluación. Las filas con conflicto muestran la
 * alerta y enlazan al detalle (lectura, sin formulario).
 */
export default function ProposalEvaluationListPage() {
  return (
    <AuthedShell
      activeId="evaluacion"
      searchPlaceholder="Buscar propuestas por título o investigador…"
    >
      {(user) => <ProposalEvaluationContent canReview={ALLOWED_ROLES.includes(user.role)} />}
    </AuthedShell>
  );
}

function ProposalEvaluationContent({ canReview }: { canReview: boolean }) {
  const [proposals, setProposals] = useState<ProposalSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!canReview) {
      return;
    }
    let active = true;
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
          setProposals(null);
          setError(
            graphqlErrorCode(queryError) === 'FORBIDDEN'
              ? 'Tu cuenta no tiene permisos para revisar propuestas.'
              : 'No pudimos cargar las propuestas pendientes.',
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
        title="Revisión reservada al Comité"
        description="Solo el Comité de Evaluación o la Coordinación pueden revisar propuestas. Si crees que es un error, contacta al administrador del sistema."
      />
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: 'Panel', href: '/dashboard' },
          { label: 'Evaluación de propuestas' },
        ]}
      />

      <PageHeader
        title="Propuestas pendientes de revisión"
        description="Protocolos en estado Propuesto o En revisión listos para dictamen."
      />

      {error && (
        <ErrorState
          className="min-h-[280px] justify-center bg-white"
          title="No pudimos cargar las propuestas"
          description={error}
          onRetry={() => {
            setError(null);
            setProposals(null);
            setReloadKey((key) => key + 1);
          }}
        />
      )}

      {!error && proposals === null && <ProposalsSkeleton />}

      {!error && proposals !== null && proposals.length === 0 && (
        <EmptyState
          className="bg-white px-6 py-12"
          icon={<Icon name="evaluation" className="h-5 w-5" />}
          title="No hay propuestas pendientes"
          description="Cuando un Investigador Principal radique una propuesta, aparecerá aquí para su revisión por pares."
        />
      )}

      {!error && proposals !== null && proposals.length > 0 && (
        <ul className="space-y-3">
          {proposals.map((proposal) => (
            <li
              key={proposal.projectId}
              className="rounded-xl border border-line bg-white p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
                    Proyecto #{proposal.projectId} ·{' '}
                    {STATUS_LABELS[proposal.status] ?? proposal.status}
                  </p>
                  <h2 className="mt-1 text-base font-semibold leading-snug text-ink">
                    {proposal.title}
                  </h2>
                </div>
                {proposal.hasConflict && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-warning-line bg-warning-soft px-2.5 py-1 text-[10.5px] font-semibold text-warning">
                    <Icon name="alert" className="h-3 w-3" />
                    Conflicto de interés
                  </span>
                )}
              </div>

              {proposal.matchedSurnames.length > 0 && (
                <Alert tone="warning" className="mt-3">
                  Apellidos coincidentes: {proposal.matchedSurnames.join(', ')}
                  {proposal.conflictStatus
                    ? ` · Alerta ${proposal.conflictStatus}`
                    : ''}
                </Alert>
              )}

              <Link
                href={`/proposal-evaluation/${proposal.projectId}`}
                className="group mt-4 inline-flex items-center gap-1 rounded text-[13px] font-semibold text-brand-700 transition-colors duration-150 hover:text-brand-800"
              >
                Revisar propuesta
                <Icon
                  name="chevronRight"
                  className="h-3.5 w-3.5 transition-transform duration-150 ease-snappy group-hover:translate-x-0.5"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ProposalsSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true">
      <span className="sr-only">Cargando propuestas…</span>
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          aria-hidden="true"
          className="rounded-xl border border-line bg-white p-5"
        >
          <Skeleton className="h-2.5 w-40" />
          <Skeleton className="mt-2 h-4 w-3/4" />
          <Skeleton className="mt-4 h-3 w-28" />
        </div>
      ))}
    </div>
  );
}
