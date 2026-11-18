'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AuthedShell } from '@/components/dashboard/authed-shell';
import { Icon } from '@/components/dashboard/icons';
import { Alert } from '@/components/ui/alert';
import { BackLink, Breadcrumbs } from '@/components/ui/breadcrumbs';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { PageHeader } from '@/components/ui/page-header';
import { ProgressBar } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CALL_STATUS_LABELS,
  effectiveStatus,
  fetchCall,
  formatCallDate,
  isAcceptingApplications,
  type Call,
} from '@/lib/calls';
import type { DashboardUser } from '@/lib/dashboard';

/**
 * F1-09 / RF-018: detalle de la convocatoria y punto de postulación.
 * La postulación reutiliza el registro de propuestas (5 PDFs, cuota y
 * BR-002) pasando `callId`; los errores CALL_FULL / CALL_CLOSED se
 * muestran ahí al confirmar.
 */
export default function CallDetailPage() {
  return (
    <AuthedShell
      activeId="convocatorias"
      searchPlaceholder="Buscar convocatorias por nombre o vigencia…"
    >
      {(user) => <CallDetailContent user={user} />}
    </AuthedShell>
  );
}

function CallDetailContent({ user }: { user: DashboardUser }) {
  const params = useParams<{ callId: string }>();
  const callId = Number(params?.callId);
  const validCallId = Number.isInteger(callId) && callId > 0;

  const [call, setCall] = useState<Call | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!validCallId) {
      return;
    }
    let active = true;
    fetchCall(callId)
      .then((result) => {
        if (active) {
          setCall(result);
        }
      })
      .catch((loadError: unknown) => {
        if (active) {
          setCall(undefined);
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'No pudimos cargar la convocatoria.',
          );
        }
      });
    return () => {
      active = false;
    };
  }, [callId, validCallId, reloadKey]);

  if (!validCallId) {
    return (
      <div className="space-y-6">
        <BackLink href="/calls">Volver a convocatorias</BackLink>
        <ErrorState
          className="min-h-[280px] justify-center bg-white"
          title="La convocatoria indicada no es válida"
          description="El enlace no contiene un identificador de convocatoria reconocible."
          action={
            <ButtonLink href="/calls" variant="secondary" size="sm">
              Ver convocatorias
            </ButtonLink>
          }
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <BackLink href="/calls">Volver a convocatorias</BackLink>
        <ErrorState
          className="min-h-[280px] justify-center bg-white"
          title="No pudimos cargar la convocatoria"
          description={error}
          onRetry={() => {
            setError(null);
            setReloadKey((key) => key + 1);
          }}
        />
      </div>
    );
  }

  if (call === undefined) {
    return <CallDetailSkeleton />;
  }

  if (call === null) {
    return (
      <div className="space-y-6">
        <BackLink href="/calls">Volver a convocatorias</BackLink>
        <EmptyState
          className="bg-white px-6 py-12"
          icon={<Icon name="calls" className="h-5 w-5" />}
          title="Convocatoria no encontrada"
          description="La convocatoria no existe o ya no está disponible para consulta."
          action={
            <ButtonLink href="/calls" variant="secondary">
              Ver convocatorias
            </ButtonLink>
          }
        />
      </div>
    );
  }

  const status = effectiveStatus(call);
  const accepting = isAcceptingApplications(call);
  const canApply = user.role === 'PRINCIPAL_INVESTIGATOR';

  return (
    <div className="space-y-5">
      <Breadcrumbs
        items={[
          { label: 'Panel', href: '/dashboard' },
          { label: 'Convocatorias', href: '/calls' },
          { label: `#${call.callId}` },
        ]}
      />

      <PageHeader
        title={call.title}
        description={`Convocatoria #${call.callId} · Publicada el ${formatCallDate(call.datePublished)}`}
        actions={
          <span
            className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
              status === 'OPEN'
                ? 'border-success-line bg-success-soft text-success'
                : 'border-line bg-surface-2 text-muted'
            }`}
          >
            {CALL_STATUS_LABELS[status]}
          </span>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <section className="rounded-xl border border-line bg-white p-5 lg:p-6">
          <h2 className="text-sm font-semibold text-ink">Descripción</h2>
          <p className="mt-2 whitespace-pre-line text-[13px] leading-relaxed text-ink/90">
            {call.description}
          </p>
        </section>

        <section className="rounded-xl border border-line bg-white p-5">
          <h2 className="text-sm font-semibold text-ink">
            Datos de la convocatoria
          </h2>
          <dl className="mt-3 space-y-2.5 text-xs">
            <Row label="Publicada" value={formatCallDate(call.datePublished)} />
            <Row label="Fecha límite" value={formatCallDate(call.deadline)} />
            <Row label="Cupo total" value={String(call.applicationCap)} />
            <Row
              label="Cupos restantes"
              value={String(call.remainingSlots)}
            />
          </dl>

          <div className="mt-4 rounded-lg border border-line bg-surface-2 p-3">
            <div className="flex items-center justify-between text-[11px] text-muted">
              <span>Ocupación del cupo</span>
              <strong className="font-semibold tabular-nums text-ink">
                {call.applicationCount}/{call.applicationCap}
              </strong>
            </div>
            <ProgressBar
              className="mt-1.5"
              label="Ocupación del cupo de la convocatoria"
              size="sm"
              tone={call.remainingSlots <= 2 ? 'warning' : 'brand'}
              value={call.applicationCount}
              max={call.applicationCap}
            />
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-line bg-white p-5 lg:p-6">
        <h2 className="text-sm font-semibold text-ink">Postulación</h2>

        {accepting ? (
          <>
            <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-muted">
              La postulación crea tu propuesta en borrador y te lleva al registro
              de los 5 documentos obligatorios. Un Investigador Principal puede
              mantener hasta 3 proyectos activos.
            </p>
            {canApply ? (
              <ButtonLink
                href={`/projects/new?callId=${call.callId}`}
                className="mt-4"
                leadingIcon={<Icon name="register" className="h-4 w-4" />}
              >
                Postular propuesta a esta convocatoria
              </ButtonLink>
            ) : (
              <Alert tone="warning" className="mt-4">
                Solo un Investigador Principal puede postular propuestas. Si tu
                rol cambia, esta acción se habilitará automáticamente.
              </Alert>
            )}
          </>
        ) : (
          <Alert tone="info" className="mt-3">
            {call.remainingSlots <= 0
              ? 'La convocatoria alcanzó su cupo máximo y ya no acepta postulaciones.'
              : 'La convocatoria está cerrada o alcanzó su fecha límite.'}
          </Alert>
        )}
      </section>

      <p className="text-xs">
        <Link
          href="/calls"
          className="rounded font-medium text-muted transition-colors duration-150 hover:text-brand-700"
        >
          ← Todas las convocatorias
        </Link>
      </p>
    </div>
  );
}

function CallDetailSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true">
      <span className="sr-only">Cargando convocatoria…</span>
      <Skeleton className="h-3 w-40" />
      <Skeleton className="h-7 w-3/4 max-w-lg" />
      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <div className="rounded-xl border border-line bg-white p-6">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-4 h-3 w-full" />
          <Skeleton className="mt-2 h-3 w-5/6" />
          <Skeleton className="mt-2 h-3 w-2/3" />
        </div>
        <div className="rounded-xl border border-line bg-white p-5">
          <Skeleton className="h-4 w-40" />
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} className="mt-3 h-3 w-full" />
          ))}
        </div>
      </div>
    </div>
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
