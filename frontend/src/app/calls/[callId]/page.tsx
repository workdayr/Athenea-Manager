'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useToast } from '@/components/ui/toast-provider';
import { authClient } from '@/lib/auth-client';
import {
  CALL_STATUS_LABELS,
  effectiveStatus,
  fetchCall,
  formatCallDate,
  isAcceptingApplications,
  type Call,
} from '@/lib/calls';
import { toPlatformRole, type PlatformRole } from '@/lib/dashboard';

/**
 * F1-09 / RF-018: detalle de la convocatoria y punto de postulacion.
 * La postulacion reutiliza el registro de propuestas (5 PDFs, cuota y
 * BR-002) pasando `callId`; los errores CALL_FULL / CALL_CLOSED se
 * muestran ahi al confirmar.
 */
export default function CallDetailPage() {
  const router = useRouter();
  const params = useParams<{ callId: string }>();
  const callId = Number(params?.callId);
  const toast = useToast();

  const [checking, setChecking] = useState(true);
  const [role, setRole] = useState<PlatformRole>('STUDENT');
  const [call, setCall] = useState<Call | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    if (!Number.isInteger(callId) || callId < 1) {
      router.replace('/calls');
      return;
    }
    authClient.getSession().then(({ data }) => {
      if (!active) {
        return;
      }
      if (!data?.user) {
        router.replace('/login');
        return;
      }
      setRole(toPlatformRole((data.user as { role?: unknown }).role));
      setChecking(false);
      fetchCall(callId)
        .then((result) => {
          if (active) {
            setCall(result);
          }
        })
        .catch(() => {
          if (active) {
            setCall(null);
            toast.error(
              'No fue posible cargar la convocatoria. Intenta de nuevo.',
              'No se pudo cargar',
            );
          }
        });
    });
    return () => {
      active = false;
    };
  }, [callId, router, toast]);

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-600">Verificando sesión…</p>
      </main>
    );
  }

  if (call === undefined) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-600">Cargando convocatoria…</p>
      </main>
    );
  }

  if (call === null) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <section className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold text-gray-900">
            Convocatoria no encontrada
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            La convocatoria no existe o ya no está disponible.
          </p>
          <Link
            href="/calls"
            className="mt-4 inline-block text-sm font-medium text-blue-700 hover:underline"
          >
            Ver convocatorias
          </Link>
        </section>
      </main>
    );
  }

  const status = effectiveStatus(call);
  const accepting = isAcceptingApplications(call);
  const canApply = role === 'PRINCIPAL_INVESTIGATOR';

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto w-full max-w-3xl">
        <p className="text-xs font-medium text-blue-700">
          CONVOCATORIA #{call.callId} · RF-018
        </p>
        <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold text-gray-900">{call.title}</h1>
          <span
            className={
              status === 'OPEN'
                ? 'rounded-full border border-green-300 bg-green-50 px-3 py-1 text-xs font-medium text-green-800'
                : 'rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700'
            }
          >
            {CALL_STATUS_LABELS[status]}
          </span>
        </div>

        <section className="mt-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="whitespace-pre-line text-sm text-gray-700">
            {call.description}
          </p>

          <dl className="mt-6 grid gap-3 text-sm text-gray-700 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-gray-500">Publicada</dt>
              <dd className="font-medium">
                {formatCallDate(call.datePublished)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Fecha límite</dt>
              <dd className="font-medium">{formatCallDate(call.deadline)}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Cupo total</dt>
              <dd className="font-medium">{call.applicationCap}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Cupos restantes</dt>
              <dd className="font-medium">{call.remainingSlots}</dd>
            </div>
          </dl>
        </section>

        <section className="mt-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Postulación</h2>

          {accepting ? (
            <>
              <p className="mt-1 text-sm text-gray-600">
                La postulación crea tu propuesta en borrador y te lleva al
                registro de los 5 documentos obligatorios. Recuerda que un
                Investigador Principal puede mantener hasta 3 proyectos
                activos (BR-002).
              </p>
              {canApply ? (
                <Link
                  href={`/projects/new?callId=${call.callId}`}
                  className="mt-4 inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Postular propuesta a esta convocatoria
                </Link>
              ) : (
                <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  Solo un Investigador Principal puede postular propuestas
                  (BR-001).
                </p>
              )}
            </>
          ) : (
            <p className="mt-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
              {call.remainingSlots <= 0
                ? 'La convocatoria alcanzó su cupo máximo y ya no acepta postulaciones.'
                : 'La convocatoria está cerrada o alcanzó su fecha límite.'}
            </p>
          )}
        </section>

        <p className="mt-8 flex gap-4 text-sm">
          <Link
            href="/calls"
            className="font-medium text-blue-700 hover:underline"
          >
            ← Todas las convocatorias
          </Link>
          <Link
            href="/dashboard"
            className="font-medium text-blue-700 hover:underline"
          >
            Panel principal
          </Link>
        </p>
      </div>
    </main>
  );
}
