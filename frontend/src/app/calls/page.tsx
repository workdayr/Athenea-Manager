'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useToast } from '@/components/ui/toast-provider';
import { authClient } from '@/lib/auth-client';
import {
  CALL_STATUS_LABELS,
  effectiveStatus,
  fetchCalls,
  formatCallDate,
  type Call,
} from '@/lib/calls';
import { toPlatformRole, type PlatformRole } from '@/lib/dashboard';

/**
 * F1-09 / RF-018: listado de convocatorias institucionales.
 * Muestra las vigentes (con cupo restante) y el historial de cerradas.
 */
export default function CallsPage() {
  const router = useRouter();
  const toast = useToast();
  const [checking, setChecking] = useState(true);
  const [role, setRole] = useState<PlatformRole>('STUDENT');
  const [calls, setCalls] = useState<Call[] | null>(null);

  useEffect(() => {
    let active = true;
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
      fetchCalls()
        .then((result) => {
          if (active) {
            setCalls(result);
          }
        })
        .catch(() => {
          if (active) {
            toast.error(
              'No fue posible cargar las convocatorias. Intenta de nuevo.',
              'No se pudo cargar la lista',
            );
          }
        });
    });
    return () => {
      active = false;
    };
  }, [router, toast]);

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

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-600">Verificando sesión…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto w-full max-w-4xl">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-blue-700">
              CONVOCATORIAS INSTITUCIONALES · RF-018
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-gray-900">
              Convocatorias de investigación
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              Consulta los fondos disponibles, su fecha límite y los cupos
              restantes antes de postular tu propuesta.
            </p>
          </div>
          {role === 'ADMINISTRATOR' && (
            <Link
              href="/admin/calls"
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Gestionar convocatorias
            </Link>
          )}
        </div>

        <section className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900">
            Convocatorias abiertas
          </h2>
          {calls === null ? (
            <p className="mt-3 text-sm text-gray-600">Cargando…</p>
          ) : open.length === 0 ? (
            <p className="mt-3 rounded-md border border-gray-200 bg-white px-3 py-4 text-sm text-gray-600">
              No hay convocatorias abiertas por el momento.
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {open.map((call) => (
                <li
                  key={call.callId}
                  className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {call.title}
                      </h3>
                      <p className="mt-1 line-clamp-2 text-sm text-gray-600">
                        {call.description}
                      </p>
                    </div>
                    <span className="rounded-full border border-green-300 bg-green-50 px-3 py-1 text-xs font-medium text-green-800">
                      {CALL_STATUS_LABELS.OPEN}
                    </span>
                  </div>
                  <dl className="mt-4 grid gap-2 text-sm text-gray-700 sm:grid-cols-3">
                    <div>
                      <dt className="text-xs text-gray-500">Fecha límite</dt>
                      <dd className="font-medium">
                        {formatCallDate(call.deadline)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-gray-500">Cupo</dt>
                      <dd className="font-medium">
                        {call.applicationCount} de {call.applicationCap}{' '}
                        postulaciones
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-gray-500">Cupos restantes</dt>
                      <dd className="font-medium">{call.remainingSlots}</dd>
                    </div>
                  </dl>
                  <Link
                    href={`/calls/${call.callId}`}
                    className="mt-4 inline-block text-sm font-medium text-blue-700 hover:underline"
                  >
                    Ver convocatoria y postular →
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {closed.length > 0 && (
          <section className="mt-8">
            <h2 className="text-lg font-semibold text-gray-900">
              Convocatorias cerradas
            </h2>
            <ul className="mt-3 divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white shadow-sm">
              {closed.map((call) => (
                <li
                  key={call.callId}
                  className="flex flex-wrap items-center justify-between gap-2 px-5 py-4"
                >
                  <div>
                    <p className="font-medium text-gray-900">{call.title}</p>
                    <p className="text-xs text-gray-500">
                      Cierre: {formatCallDate(call.deadline)} ·{' '}
                      {call.applicationCount} de {call.applicationCap}{' '}
                      postulaciones
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                      {effectiveStatus(call) === 'DRAFT'
                        ? CALL_STATUS_LABELS.DRAFT
                        : CALL_STATUS_LABELS.CLOSED}
                    </span>
                    <Link
                      href={`/calls/${call.callId}`}
                      className="text-sm font-medium text-blue-700 hover:underline"
                    >
                      Ver detalle
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="mt-8 text-sm">
          <Link
            href="/dashboard"
            className="font-medium text-blue-700 hover:underline"
          >
            ← Volver al panel
          </Link>
        </p>
      </div>
    </main>
  );
}
