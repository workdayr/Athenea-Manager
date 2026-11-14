'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useToast } from '@/components/ui/toast-provider';
import { graphqlErrorCode } from '@/lib/apollo-client';
import { authClient } from '@/lib/auth-client';
import {
  CALL_STATUS_LABELS,
  closeCall,
  createCall,
  effectiveStatus,
  fetchCalls,
  formatCallDate,
  publishCall,
  type Call,
} from '@/lib/calls';

const TITLE_MAX = 200;
const DESCRIPTION_MAX = 4000;
const CAP_MAX = 999;

/**
 * F1-09 / RF-018: creacion, publicacion y cierre de convocatorias.
 * Solo ADMINISTRATOR; el backend valida el rol, el deadline y el estado.
 */
export default function AdminCallsPage() {
  const router = useRouter();
  const toast = useToast();
  const [checking, setChecking] = useState(true);
  const [denied, setDenied] = useState(false);
  const [calls, setCalls] = useState<Call[] | null>(null);
  const [workingId, setWorkingId] = useState<number | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [cap, setCap] = useState('10');
  const [creating, setCreating] = useState(false);

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

  const reload = useCallback(async () => {
    try {
      setCalls(await fetchCalls());
    } catch {
      toast.error('No fue posible actualizar la lista de convocatorias.');
    }
  }, [toast]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim() || title.trim().length > TITLE_MAX) {
      toast.error(`El título es obligatorio (máximo ${TITLE_MAX} caracteres).`);
      return;
    }
    if (!description.trim() || description.trim().length > DESCRIPTION_MAX) {
      toast.error(
        `La descripción es obligatoria (máximo ${DESCRIPTION_MAX} caracteres).`,
      );
      return;
    }
    const parsedCap = Number(cap);
    if (!Number.isInteger(parsedCap) || parsedCap < 1 || parsedCap > CAP_MAX) {
      toast.error(`El cupo debe ser un entero entre 1 y ${CAP_MAX}.`);
      return;
    }
    const deadlineDate = new Date(deadline);
    if (!deadline || Number.isNaN(deadlineDate.getTime())) {
      toast.error('Indica una fecha límite válida.');
      return;
    }
    if (deadlineDate.getTime() <= Date.now()) {
      toast.error('La fecha límite debe ser futura.');
      return;
    }

    setCreating(true);
    try {
      await createCall({
        title: title.trim(),
        description: description.trim(),
        deadline: deadlineDate.toISOString(),
        applicationCap: parsedCap,
      });
      toast.success(
        'La convocatoria quedó en borrador. Publícala para recibir postulaciones.',
        'Convocatoria creada',
      );
      setTitle('');
      setDescription('');
      setDeadline('');
      setCap('10');
      await reload();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'No fue posible crear la convocatoria. Intenta de nuevo.',
        'No se pudo crear',
      );
    } finally {
      setCreating(false);
    }
  }

  async function handlePublish(call: Call) {
    if (
      !window.confirm(
        `¿Publicar "${call.title}"? Desde ese momento recibirá postulaciones hasta el cupo o la fecha límite.`,
      )
    ) {
      return;
    }
    setWorkingId(call.callId);
    try {
      await publishCall(call.callId);
      toast.success('La convocatoria está abierta.', 'Convocatoria publicada');
      await reload();
    } catch (error) {
      const code = graphqlErrorCode(error);
      toast.error(
        code === 'CONFLICT'
          ? 'La convocatoria está cerrada y no puede reabrirse.'
          : error instanceof Error
            ? error.message
            : 'No fue posible publicar la convocatoria. Intenta de nuevo.',
        'No se pudo publicar',
      );
    } finally {
      setWorkingId(null);
    }
  }

  async function handleClose(call: Call) {
    if (
      !window.confirm(
        `¿Cerrar "${call.title}"? Las postulaciones se detendrán de inmediato.`,
      )
    ) {
      return;
    }
    setWorkingId(call.callId);
    try {
      await closeCall(call.callId);
      toast.success('La convocatoria quedó cerrada.', 'Convocatoria cerrada');
      await reload();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'No fue posible cerrar la convocatoria. Intenta de nuevo.',
        'No se pudo cerrar',
      );
    } finally {
      setWorkingId(null);
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
          <h1 className="text-xl font-semibold text-gray-900">
            Acceso denegado
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Solo la administración puede crear y publicar convocatorias
            (RF-018).
          </p>
        </section>
      </main>
    );
  }

  const inputClassName =
    'w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-600 focus:outline-none';

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto w-full max-w-5xl">
        <p className="text-xs font-medium text-blue-700">
          ADMINISTRACIÓN · RF-018
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-gray-900">
          Gestión de convocatorias
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Crea la convocatoria en borrador, publícala para abrir el registro y
          ciérrala cuando termine el periodo.
        </p>

        <section className="mt-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">
            Nueva convocatoria
          </h2>
          <form onSubmit={handleCreate} className="mt-4 space-y-4" noValidate>
            <div>
              <label
                htmlFor="title"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Título *
              </label>
              <input
                id="title"
                type="text"
                required
                maxLength={TITLE_MAX}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Convocatoria de Fondos de Investigación 2027"
                className={inputClassName}
              />
            </div>

            <div>
              <label
                htmlFor="description"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Descripción *
              </label>
              <textarea
                id="description"
                required
                rows={4}
                maxLength={DESCRIPTION_MAX}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Bases, requisitos y criterios de elegibilidad…"
                className={inputClassName}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="deadline"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Fecha y hora límite *
                </label>
                <input
                  id="deadline"
                  type="datetime-local"
                  required
                  value={deadline}
                  onChange={(event) => setDeadline(event.target.value)}
                  className={inputClassName}
                />
              </div>
              <div>
                <label
                  htmlFor="cap"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Cupo de postulaciones *
                </label>
                <input
                  id="cap"
                  type="number"
                  required
                  min={1}
                  max={CAP_MAX}
                  value={cap}
                  onChange={(event) => setCap(event.target.value)}
                  className={inputClassName}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={creating}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {creating ? 'Creando…' : 'Crear borrador'}
            </button>
          </form>
        </section>

        <section className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Convocatorias registradas
            </h2>
          </div>
          {calls === null ? (
            <p className="px-5 py-6 text-sm text-gray-600">Cargando…</p>
          ) : calls.length === 0 ? (
            <p className="px-5 py-6 text-sm text-gray-600">
              Aún no hay convocatorias registradas.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">Convocatoria</th>
                    <th className="px-5 py-3 font-medium">Estado</th>
                    <th className="px-5 py-3 font-medium">Cupo</th>
                    <th className="px-5 py-3 font-medium">Cierre</th>
                    <th className="px-5 py-3 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {calls.map((call) => {
                    const status = effectiveStatus(call);
                    return (
                      <tr key={call.callId}>
                        <td className="px-5 py-3">
                          <p className="font-medium text-gray-900">
                            {call.title}
                          </p>
                          <p className="line-clamp-1 text-xs text-gray-500">
                            {call.description}
                          </p>
                        </td>
                        <td className="px-5 py-3">
                          <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                            {CALL_STATUS_LABELS[status]}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-gray-700">
                          {call.applicationCount} / {call.applicationCap}
                        </td>
                        <td className="px-5 py-3 text-gray-700">
                          {formatCallDate(call.deadline)}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex flex-wrap gap-2">
                            <Link
                              href={`/calls/${call.callId}`}
                              className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                            >
                              Ver
                            </Link>
                            {call.status === 'DRAFT' && (
                              <button
                                type="button"
                                disabled={workingId === call.callId}
                                onClick={() => void handlePublish(call)}
                                className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                              >
                                {workingId === call.callId
                                  ? 'Publicando…'
                                  : 'Publicar'}
                              </button>
                            )}
                            {call.status === 'OPEN' && (
                              <button
                                type="button"
                                disabled={workingId === call.callId}
                                onClick={() => void handleClose(call)}
                                className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                              >
                                {workingId === call.callId
                                  ? 'Cerrando…'
                                  : 'Cerrar'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <p className="mt-8 text-sm">
          <Link
            href="/calls"
            className="font-medium text-blue-700 hover:underline"
          >
            ← Ver convocatorias públicas
          </Link>
        </p>
      </div>
    </main>
  );
}
