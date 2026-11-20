'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { AuthedShell } from '@/components/dashboard/authed-shell';
import { Icon } from '@/components/dashboard/icons';
import { Alert } from '@/components/ui/alert';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Button, ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Textarea } from '@/components/ui/field';
import { ConfirmDialog } from '@/components/ui/modal';
import { NoAccess } from '@/components/ui/no-access';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/components/ui/toast-provider';
import type { DashboardUser } from '@/lib/dashboard';
import { STATUS_LABELS } from '@/lib/dashboard';
import { getApolloClient, graphqlErrorCode } from '@/lib/apollo-client';
import {
  blockReasonMessage,
  DECISION_LABELS,
  downloadDecisionReport,
  fetchDecisionReportStatus,
  PROPOSAL_EVALUATION_CONTEXT_QUERY,
  SUBMIT_PROJECT_DECISION_MUTATION,
  type DecisionReport,
  type ProposalContext,
} from '@/lib/proposal-evaluation';
import { PROJECT_ROLE_LABELS } from '@/lib/teams';

const ALLOWED_ROLES = ['COMMITTEE', 'COORDINATOR'];
const JUSTIFICATION_MAX = 4000;

const DECISIONS = ['Approved', 'Rejected', 'Revision_Required'] as const;

const DECISION_HELP: Record<string, string> = {
  Approved: 'El proyecto pasa a la etapa de ejecución y se notifica al equipo.',
  Rejected: 'La propuesta se cierra con el dictamen registrado en la bitácora.',
  Revision_Required: 'El equipo debe corregir la propuesta y volver a radicarla.',
};

/**
 * Pasos 2-6: detalle de la propuesta con equipo, alerta de
 * conflicto (bloqueante) y formulario de decisión formal
 * con justificación obligatoria.
 */
export default function ProposalEvaluationDetailPage() {
  return (
    <AuthedShell
      activeId="evaluacion"
      searchPlaceholder="Buscar propuestas por título o investigador…"
    >
      {(user) => <ProposalEvaluationDetail user={user} />}
    </AuthedShell>
  );
}

function ProposalEvaluationDetail({ user }: { user: DashboardUser }) {
  const toast = useToast();
  const params = useParams<{ projectId: string }>();
  const projectId = Number(params?.projectId);
  const validProjectId = Number.isInteger(projectId) && projectId > 0;
  const canReview = ALLOWED_ROLES.includes(user.role);

  const [context, setContext] = useState<ProposalContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [decision, setDecision] = useState<string>('Approved');
  const [justification, setJustification] = useState('');
  const [justificationError, setJustificationError] = useState<string | null>(
    null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [pendingDecision, setPendingDecision] = useState<string | null>(null);

  useEffect(() => {
    if (!canReview || !validProjectId) {
      return;
    }
    let active = true;
    getApolloClient()
      .query<{ proposalEvaluationContext: ProposalContext }>({
        query: PROPOSAL_EVALUATION_CONTEXT_QUERY,
        variables: { projectId },
        fetchPolicy: 'network-only',
      })
      .then(({ data }) => {
        if (active) {
          setContext(data?.proposalEvaluationContext ?? null);
          setError(null);
        }
      })
      .catch((queryError: unknown) => {
        if (active) {
          setContext(null);
          setError(
            graphqlErrorCode(queryError) === 'NOT_FOUND'
              ? 'El proyecto no existe o ya no está disponible para evaluación.'
              : 'No pudimos cargar la propuesta.',
          );
        }
      });
    return () => {
      active = false;
    };
  }, [canReview, projectId, reloadKey, validProjectId]);

  async function submitDecision(chosen: string) {
    setSubmitting(true);
    try {
      const { data } = await getApolloClient().mutate<{
        submitProjectDecision: { status: string; decision: string };
      }>({
        mutation: SUBMIT_PROJECT_DECISION_MUTATION,
        variables: {
          input: {
            projectId,
            decision: chosen,
            justification: justification.trim(),
          },
        },
      });
      const status = data?.submitProjectDecision.status;
      toast.success(
        `Decisión registrada: ${
          DECISION_LABELS[data?.submitProjectDecision.decision ?? ''] ?? ''
        } · estado del proyecto: ${status}.`,
        'Decisión registrada',
      );
      setPendingDecision(null);
      setJustification('');
      setJustificationError(null);
      setReloadKey((key) => key + 1);
    } catch (submitError: unknown) {
      const code = graphqlErrorCode(submitError);
      if (code === 'FAMILY_CONFLICT') {
        toast.error(
          'Conflicto de interés familiar: la evaluación está bloqueada hasta la revisión del Administrador.',
          'Evaluación bloqueada',
        );
        setReloadKey((key) => key + 1);
      } else if (code === 'SELF_REVIEW') {
        toast.error(
          'No puedes evaluar un proyecto de tu propio equipo.',
          'Evaluación bloqueada',
        );
      } else if (code === 'DEPARTMENT_CONFLICT') {
        toast.error(
          'No puedes evaluar un proyecto del mismo departamento que el Investigador Principal.',
          'Evaluación bloqueada',
        );
        setReloadKey((key) => key + 1);
      } else if (code === 'INVALID_STATE') {
        toast.error(
          'El proyecto ya no admite decisión en su estado actual.',
          'Estado desactualizado',
        );
        setReloadKey((key) => key + 1);
      } else {
        toast.error(
          submitError instanceof Error
            ? submitError.message
            : 'No pudimos registrar la decisión. Inténtalo de nuevo.',
          'No se pudo registrar la decisión',
        );
      }
      setPendingDecision(null);
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = justification.trim();
    if (text.length === 0) {
      setJustificationError(
        'La justificación de la decisión es obligatoria.',
      );
      document.getElementById('justification')?.focus();
      return;
    }
    setJustificationError(null);
    setPendingDecision(decision);
  }

  if (!canReview) {
    return (
      <NoAccess
        title="Evaluación reservada al Comité"
        description="Solo el Comité de Evaluación o la Coordinación pueden emitir dictámenes sobre una propuesta."
      />
    );
  }

  if (!validProjectId) {
    return (
      <div className="space-y-6">
        <ButtonLink href="/proposal-evaluation" variant="secondary" size="sm">
          ← Volver a propuestas
        </ButtonLink>
        <ErrorState
          className="min-h-[280px] justify-center bg-white"
          title="El proyecto indicado no es válido"
          description="El enlace no contiene un identificador de proyecto reconocible."
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <ButtonLink href="/proposal-evaluation" variant="secondary" size="sm">
          ← Volver a propuestas
        </ButtonLink>
        <ErrorState
          className="min-h-[280px] justify-center bg-white"
          title="No pudimos cargar la propuesta"
          description={error}
          onRetry={() => {
            setError(null);
            setReloadKey((key) => key + 1);
          }}
        />
      </div>
    );
  }

  if (!context) {
    return <ProposalDetailSkeleton />;
  }

  const blockMessage = blockReasonMessage(
    context.blockReason,
    context.matchedSurnames,
  );

  return (
    <div className="space-y-5">
      <Breadcrumbs
        items={[
          { label: 'Panel', href: '/dashboard' },
          { label: 'Evaluación', href: '/proposal-evaluation' },
          { label: `Proyecto #${context.projectId}` },
        ]}
      />

      <PageHeader
        title={context.title}
        description={`Proyecto #${context.projectId} · Estado: ${
          STATUS_LABELS[context.status] ?? context.status
        }`}
        actions={
          <span className="rounded-full border border-line bg-white px-2.5 py-1 text-[11px] font-semibold text-ink">
            {STATUS_LABELS[context.status] ?? context.status}
          </span>
        }
      />

      {blockMessage && (
        <Alert
          tone="warning"
          title="Evaluación bloqueada"
          action={
            context.conflict ? (
              <span className="rounded-full border border-warning-line bg-white px-2 py-0.5 text-[10.5px] font-medium text-warning">
                Alerta #{context.conflict.conflictId}
              </span>
            ) : undefined
          }
        >
          <p>{blockMessage}</p>
          {context.conflict && (
            <p className="mt-1 text-[11.5px]">
              Estado de la alerta: {context.conflict.status}
              {context.conflict.resolutionNote
                ? ` · Nota: ${context.conflict.resolutionNote}`
                : ''}
            </p>
          )}
        </Alert>
      )}

      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <section className="rounded-xl border border-line bg-white p-5 lg:p-6">
          <h2 className="text-sm font-semibold text-ink">Propuesta</h2>
          <p className="mt-2 whitespace-pre-line text-[13px] leading-relaxed text-ink/90">
            {context.objectives}
          </p>
        </section>

        <section className="rounded-xl border border-line bg-white p-5">
          <h2 className="text-sm font-semibold text-ink">Equipo del proyecto</h2>
          {context.team.length === 0 ? (
            <p className="mt-2 text-xs text-muted">
              El equipo todavía no registra integrantes.
            </p>
          ) : (
            <ul className="mt-3 space-y-2.5">
              {context.team.map((member) => (
                <li key={member.userId} className="flex items-start justify-between gap-3 text-xs">
                  <span className="font-medium text-ink">{member.name}</span>
                  <span className="text-right text-muted">
                    {PROJECT_ROLE_LABELS[
                      member.projectRole as keyof typeof PROJECT_ROLE_LABELS
                    ] ?? member.projectRole}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {context.evaluations.length > 0 && (
        <section className="rounded-xl border border-line bg-white p-5 lg:p-6">
          <h2 className="text-sm font-semibold text-ink">
            Historial de decisiones
          </h2>
          <ul className="mt-3 space-y-3">
            {context.evaluations.map((item) => (
              <li
                key={item.evaluationId}
                className="rounded-lg border border-line bg-surface-2 p-3.5"
              >
                <p className="text-[13px] font-semibold text-ink">
                  {DECISION_LABELS[item.decision] ?? item.decision} ·{' '}
                  <span className="font-normal text-muted">
                    {item.reviewerName}
                  </span>
                </p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-ink/90">
                  {item.justification}
                </p>
                {/*: dictamen PDF asíncrono. */}
                <DecisionReportPanel evaluationId={Number(item.evaluationId)} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {context.canEvaluate ? (
        <section className="rounded-xl border border-line bg-white p-5 lg:p-6">
          <h2 className="text-sm font-semibold text-ink">Registrar decisión</h2>
          <p className="mt-1 text-[12px] text-muted">
            El dictamen es definitivo y queda en la bitácora de auditoría.
          </p>

          <form onSubmit={handleSubmit} className="mt-4 space-y-4" noValidate>
            <fieldset>
              <legend className="mb-2 text-[13px] font-medium text-ink">
                Decisión
              </legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {DECISIONS.map((value) => {
                  const selected = decision === value;
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
                        name="decision"
                        value={value}
                        className="mt-0.5 accent-brand-700"
                        checked={selected}
                        onChange={(event) => setDecision(event.target.value)}
                      />
                      <span className="min-w-0">
                        <span className="block text-[12.5px] font-medium text-ink">
                          {DECISION_LABELS[value]}
                        </span>
                        <span className="mt-0.5 block text-[11px] leading-snug text-muted">
                          {DECISION_HELP[value]}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <div>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[11px] text-muted">
                  Se guarda en el acta del comité.
                </span>
                <span
                  className="text-[11px] tabular-nums text-muted"
                  aria-live="polite"
                >
                  {justification.length} / {JUSTIFICATION_MAX}
                </span>
              </div>
              <Textarea
                id="justification"
                label="Justificación"
                required
                rows={5}
                maxLength={JUSTIFICATION_MAX}
                value={justification}
                error={justificationError || undefined}
                onChange={(event) => {
                  setJustification(event.target.value);
                  setJustificationError(null);
                }}
                placeholder="Minuta de revisión con observaciones del comité…"
                wrapperClassName="mt-1.5"
              />
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setJustification('')}
                disabled={justification.length === 0 || submitting}
              >
                Limpiar
              </Button>
              <Button type="submit" loading={submitting}>
                {submitting ? 'Registrando decisión…' : 'Registrar decisión'}
              </Button>
            </div>
          </form>
        </section>
      ) : (
        <EmptyState
          compact
          className="bg-white"
          title="La evaluación no está disponible"
          description="La propuesta no se encuentra en un estado evaluable, o tu cuenta ya emitió un dictamen sobre ella."
        />
      )}

      <p className="text-xs">
        <Link
          href="/proposal-evaluation"
          className="rounded font-medium text-muted transition-colors duration-150 hover:text-brand-700"
        >
          ← Volver a propuestas pendientes
        </Link>
      </p>

      <ConfirmDialog
        open={pendingDecision !== null}
        onClose={() => setPendingDecision(null)}
        onConfirm={() => {
          if (pendingDecision) {
            void submitDecision(pendingDecision);
          }
        }}
        title={`Registrar dictamen: ${
          pendingDecision ? DECISION_LABELS[pendingDecision] : ''
        }`}
        description={
          <>
            El dictamen se registrará a nombre de tu cuenta y notificará al
            equipo del proyecto. Esta acción es definitiva y no se puede
            deshacer desde la plataforma.
          </>
        }
        confirmLabel="Registrar dictamen"
        tone={pendingDecision === 'Rejected' ? 'danger' : 'primary'}
        loading={submitting}
      />
    </div>
  );
}

/**
 * estado del dictamen PDF de una decisión. Consulta al
 * servidor y reintenta cada 3 s mientras el worker lo genera; no bloquea
 * la evaluación ni el resto de la pantalla.
 */
function DecisionReportPanel({ evaluationId }: { evaluationId: number }) {
  const toast = useToast();
  const [report, setReport] = useState<DecisionReport | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function poll() {
      try {
        const status = await fetchDecisionReportStatus(evaluationId);
        if (!active) {
          return;
        }
        setReport(status);
        if (status.status === 'Pending') {
          timer = setTimeout(() => void poll(), 3_000);
        }
      } catch {
        if (active) {
          setReport(null);
        }
      }
    }

    void poll();
    return () => {
      active = false;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [evaluationId]);

  async function handleDownload() {
    setDownloading(true);
    try {
      await downloadDecisionReport(evaluationId);
      toast.success('El dictamen PDF se descargó.', 'Descarga iniciada');
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'No pudimos descargar el dictamen.',
        'Descarga no disponible',
      );
    } finally {
      setDownloading(false);
    }
  }

  if (!report) {
    return null;
  }

  if (report.status === 'Pending') {
    return (
      <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted">
        <Spinner className="h-3 w-3" />
        Generando dictamen en PDF…
      </p>
    );
  }

  if (report.status === 'Failed') {
    return (
      <p className="mt-2 flex items-center gap-1.5 text-[11px] text-danger">
        <Icon name="alert" className="h-3 w-3" />
        No se pudo generar el dictamen PDF. Soporte revisará el error.
      </p>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void handleDownload()}
      disabled={downloading}
      className="mt-2 inline-flex items-center gap-1.5 rounded text-[11px] font-semibold text-brand-700 transition-colors duration-150 hover:text-brand-800 hover:underline disabled:opacity-60"
    >
      {downloading ? (
        <Spinner className="h-3 w-3" />
      ) : (
        <Icon name="download" className="h-3 w-3" />
      )}
      {downloading ? 'Descargando…' : 'Descargar dictamen PDF'}
    </button>
  );
}

function ProposalDetailSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true">
      <span className="sr-only">Cargando propuesta…</span>
      <Skeleton className="h-3 w-48" />
      <Skeleton className="h-7 w-3/4 max-w-xl" />
      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <div className="rounded-xl border border-line bg-white p-6">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-4 h-3 w-full" />
          <Skeleton className="mt-2 h-3 w-5/6" />
          <Skeleton className="mt-2 h-3 w-2/3" />
        </div>
        <div className="rounded-xl border border-line bg-white p-5">
          <Skeleton className="h-4 w-40" />
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="mt-3 h-3 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
