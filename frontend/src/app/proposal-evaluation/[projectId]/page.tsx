'use client';

import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useToast } from '@/components/ui/toast-provider';
import { authClient } from '@/lib/auth-client';
import {
  getApolloClient,
  graphqlErrorCode,
} from '@/lib/apollo-client';
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

const ALLOWED_ROLES = ['COMMITTEE', 'COORDINATOR'];
const JUSTIFICATION_MAX = 4000;

const DECISIONS = ['Approved', 'Rejected', 'Revision_Required'] as const;

const inputClassName =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:border-blue-600 focus:outline-none';

/**
 * UC-003 pasos 2-6: detalle de la propuesta con equipo, alerta de
 * conflicto (BR-011, bloqueante) y formulario de decisión formal
 * con justificación obligatoria (RF-019).
 */
export default function ProposalEvaluationDetailPage() {
  const router = useRouter();
  const toast = useToast();
  const params = useParams<{ projectId: string }>();
  const projectId = Number(params?.projectId);

  const [checking, setChecking] = useState(true);
  const [denied, setDenied] = useState(false);
  const [context, setContext] = useState<ProposalContext | null>(null);
  const [decision, setDecision] = useState<string>('Approved');
  const [justification, setJustification] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadContext = useCallback(async () => {
    if (!Number.isInteger(projectId)) {
      toast.error('Identificador de proyecto inválido.');
      return;
    }
    try {
      const { data } = await getApolloClient().query<{
        proposalEvaluationContext: ProposalContext;
      }>({
        query: PROPOSAL_EVALUATION_CONTEXT_QUERY,
        variables: { projectId },
        fetchPolicy: 'network-only',
      });
      setContext(data?.proposalEvaluationContext ?? null);
    } catch (queryError: unknown) {
      const code = graphqlErrorCode(queryError);
      toast.error(
        code === 'NOT_FOUND'
          ? 'El proyecto no existe.'
          : 'No fue posible cargar la propuesta. Intenta de nuevo.',
        'No se pudo cargar la propuesta',
      );
    }
  }, [projectId, toast]);

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
      void loadContext();
    });
    return () => {
      active = false;
    };
  }, [router, loadContext]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (justification.trim().length === 0) {
      toast.error('La justificación de la decisión es obligatoria (RF-019).');
      return;
    }
    if (justification.trim().length > JUSTIFICATION_MAX) {
      toast.error(`La justificación excede ${JUSTIFICATION_MAX} caracteres.`);
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await getApolloClient().mutate<{
        submitProjectDecision: { status: string; decision: string };
      }>({
        mutation: SUBMIT_PROJECT_DECISION_MUTATION,
        variables: {
          input: {
            projectId,
            decision,
            justification: justification.trim(),
          },
        },
      });
      const status = data?.submitProjectDecision.status;
      toast.success(
        `Decisión registrada: ${DECISION_LABELS[data?.submitProjectDecision.decision ?? ''] ?? ''} · estado del proyecto: ${status}.`,
        'Decisión registrada',
      );
      setJustification('');
      await loadContext();
    } catch (submitError: unknown) {
      const code = graphqlErrorCode(submitError);
      if (code === 'FAMILY_CONFLICT') {
        toast.error(
          'Conflicto de interés familiar (BR-011): la evaluación está bloqueada hasta la revisión del Administrador.',
          'Evaluación bloqueada',
        );
        await loadContext();
      } else if (code === 'SELF_REVIEW') {
        toast.error(
          'No puedes evaluar un proyecto de tu propio equipo (BR-004).',
        );
      } else if (code === 'DEPARTMENT_CONFLICT') {
        toast.error(
          'No puedes evaluar un proyecto del mismo departamento que el Investigador Principal (BR-004).',
          'Evaluación bloqueada',
        );
        await loadContext();
      } else if (code === 'INVALID_STATE') {
        toast.error(
          'El proyecto ya no admite decisión en su estado actual.',
        );
        await loadContext();
      } else {
        toast.error(
          submitError instanceof Error
            ? submitError.message
            : 'No fue posible registrar la decisión. Intenta de nuevo.',
          'No se pudo registrar la decisión',
        );
      }
    } finally {
      setSubmitting(false);
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
            Solo el Comité de Evaluación o la Coordinación pueden revisar
            propuestas (UC-003).
          </p>
        </section>
      </main>
    );
  }

  const blockMessage = context
    ? blockReasonMessage(context.blockReason, context.matchedSurnames)
    : null;

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto w-full max-w-3xl">
        <p className="text-xs font-medium text-blue-700">
          EVALUACIÓN DE PROPUESTAS · UC-003 / RF-019
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-gray-900">
          {context?.title ?? `Proyecto #${params?.projectId}`}
        </h1>
        {context && (
          <p className="mt-1 text-sm text-gray-600">
            Proyecto #{context.projectId} · Estado: {context.status}
          </p>
        )}

        {blockMessage && (
          <section
            role="alert"
            className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-5"
          >
            <h2 className="text-base font-semibold text-amber-900">
              Evaluación bloqueada
            </h2>
            <p className="mt-1 text-sm text-amber-900">{blockMessage}</p>
            {context?.conflict && (
              <p className="mt-2 text-xs text-amber-800">
                Alerta #{context.conflict.conflictId} · Estado:{' '}
                {context.conflict.status}
                {context.conflict.resolutionNote
                  ? ` · Nota: ${context.conflict.resolutionNote}`
                  : ''}
              </p>
            )}
          </section>
        )}

        {context && (
          <>
            <section className="mt-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900">Propuesta</h2>
              <p className="mt-2 text-sm text-gray-700">{context.objectives}</p>
            </section>

            <section className="mt-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900">
                Equipo del proyecto
              </h2>
              <ul className="mt-2 space-y-2">
                {context.team.map((member) => (
                  <li
                    key={member.userId}
                    className="flex items-center justify-between gap-4 text-sm"
                  >
                    <span className="font-medium text-gray-900">
                      {member.name}
                    </span>
                    <span className="text-gray-500">{member.projectRole}</span>
                  </li>
                ))}
              </ul>
            </section>

            {context.evaluations.length > 0 && (
              <section className="mt-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900">
                  Historial de decisiones
                </h2>
                <ul className="mt-2 space-y-3">
                  {context.evaluations.map((item) => (
                    <li
                      key={item.evaluationId}
                      className="rounded-md bg-gray-50 p-3 ring-1 ring-gray-200"
                    >
                      <p className="text-sm font-medium text-gray-900">
                        {DECISION_LABELS[item.decision] ?? item.decision} ·{' '}
                        {item.reviewerName}
                      </p>
                      <p className="mt-1 text-sm text-gray-700">
                        {item.justification}
                      </p>
                      {/* F1-10 / RF-019: dictamen PDF asincrono. */}
                      <DecisionReportPanel
                        evaluationId={Number(item.evaluationId)}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {context.canEvaluate && (
              <section className="mt-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900">
                  Registrar decisión
                </h2>
                <form onSubmit={handleSubmit} className="mt-4 space-y-4" noValidate>
                  <fieldset>
                    <legend className="mb-2 block text-sm font-medium text-gray-700">
                      Decisión *
                    </legend>
                    <div className="space-y-2">
                      {DECISIONS.map((value) => (
                        <label
                          key={value}
                          className="flex items-center gap-2 text-sm text-gray-900"
                        >
                          <input
                            type="radio"
                            name="decision"
                            value={value}
                            checked={decision === value}
                            onChange={(event) => setDecision(event.target.value)}
                          />
                          {DECISION_LABELS[value]}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <div>
                    <div className="flex items-baseline justify-between">
                      <label
                        htmlFor="justification"
                        className="mb-1 block text-sm font-medium text-gray-700"
                      >
                        Justificación *
                      </label>
                      <span className="text-xs text-gray-500">
                        {justification.length} / {JUSTIFICATION_MAX} caracteres
                      </span>
                    </div>
                    <textarea
                      id="justification"
                      required
                      rows={5}
                      maxLength={JUSTIFICATION_MAX}
                      value={justification}
                      onChange={(event) => setJustification(event.target.value)}
                      placeholder="Minuto de revisión con observaciones del comité…"
                      className={inputClassName}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {submitting ? 'Registrando decisión…' : 'Registrar decisión'}
                  </button>
                </form>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}

/**
 * F1-10 / RF-019: estado del dictamen PDF de una decision. Consulta al
 * servidor y reintenta cada 3 s mientras el worker lo genera; no bloquea
 * la evaluacion ni el resto de la pantalla.
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
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'No fue posible descargar el dictamen.',
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
      <p className="mt-2 text-xs text-gray-500">
        Generando dictamen en PDF…
      </p>
    );
  }

  if (report.status === 'Failed') {
    return (
      <p className="mt-2 text-xs text-red-700">
        No se pudo generar el dictamen PDF. El equipo de soporte revisará el
        error.
      </p>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void handleDownload()}
      disabled={downloading}
      className="mt-2 text-xs font-medium text-blue-700 hover:underline disabled:opacity-50"
    >
      {downloading ? 'Descargando…' : 'Descargar dictamen PDF'}
    </button>
  );
}
