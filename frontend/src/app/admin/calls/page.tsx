'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { AuthedShell } from '@/components/dashboard/authed-shell';
import { Icon } from '@/components/dashboard/icons';
import { Alert } from '@/components/ui/alert';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Button, ButtonLink } from '@/components/ui/button';
import { SectionCard } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Input, Textarea } from '@/components/ui/field';
import { ConfirmDialog } from '@/components/ui/modal';
import { NoAccess } from '@/components/ui/no-access';
import { PageHeader } from '@/components/ui/page-header';
import { SkeletonRows } from '@/components/ui/skeleton';
import { TableShell, Td, Th } from '@/components/ui/table';
import { useToast } from '@/components/ui/toast-provider';
import type { DashboardUser } from '@/lib/dashboard';
import { graphqlErrorCode } from '@/lib/apollo-client';
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

const STATUS_TONES: Record<string, BadgeTone> = {
  DRAFT: 'neutral',
  OPEN: 'success',
  CLOSED: 'warning',
};

interface CallErrors {
  title?: string;
  description?: string;
  deadline?: string;
  cap?: string;
}

/**
 * Creación, publicación y cierre de convocatorias.
 * Solo ADMINISTRATOR; el backend valida el rol, el deadline y el estado.
 */
export default function AdminCallsPage() {
  return (
    <AuthedShell
      activeId="convocatorias"
      searchPlaceholder="Buscar convocatorias por nombre o estado…"
    >
      {(user) => <AdminCallsContent user={user} />}
    </AuthedShell>
  );
}

function AdminCallsContent({ user }: { user: DashboardUser }) {
  const toast = useToast();
  const canManage = user.role === 'ADMINISTRATOR';

  const [calls, setCalls] = useState<Call[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [workingId, setWorkingId] = useState<number | null>(null);
  const [pendingAction, setPendingAction] = useState<{
    call: Call;
    action: 'publish' | 'close';
  } | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [cap, setCap] = useState('10');
  const [errors, setErrors] = useState<CallErrors>({});
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!canManage) {
      return;
    }
    let active = true;
    fetchCalls()
      .then((result) => {
        if (active) {
          setCalls(result);
          setLoadError(null);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setCalls(null);
          setLoadError(
            error instanceof Error
              ? error.message
              : 'No fue posible cargar las convocatorias.',
          );
        }
      });
    return () => {
      active = false;
    };
  }, [canManage, reloadKey]);

  async function reload() {
    try {
      setCalls(await fetchCalls());
    } catch {
      toast.error(
        'No fue posible actualizar la lista de convocatorias.',
        'Lista desactualizada',
      );
    }
  }

  function validate(): boolean {
    const next: CallErrors = {};

    if (!title.trim()) {
      next.title = 'El título es obligatorio.';
    } else if (title.trim().length > TITLE_MAX) {
      next.title = `El título no puede exceder ${TITLE_MAX} caracteres.`;
    }

    if (!description.trim()) {
      next.description = 'Describe las bases y los requisitos.';
    } else if (description.trim().length > DESCRIPTION_MAX) {
      next.description = `La descripción no puede exceder ${DESCRIPTION_MAX} caracteres.`;
    }

    const parsedCap = Number(cap);
    if (!Number.isInteger(parsedCap) || parsedCap < 1 || parsedCap > CAP_MAX) {
      next.cap = `El cupo debe ser un entero entre 1 y ${CAP_MAX}.`;
    }

    const deadlineDate = new Date(deadline);
    if (!deadline) {
      next.deadline = 'Indica la fecha y hora límite.';
    } else if (Number.isNaN(deadlineDate.getTime())) {
      next.deadline = 'La fecha límite no es válida.';
    } else if (deadlineDate.getTime() <= Date.now()) {
      next.deadline = 'La fecha límite debe ser futura.';
    }

    setErrors(next);
    const firstInvalid = (['title', 'description', 'deadline', 'cap'] as const).find(
      (key) => next[key],
    );
    if (firstInvalid) {
      document.getElementById(firstInvalid)?.focus();
      return false;
    }
    return true;
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validate()) {
      return;
    }
    setCreating(true);
    try {
      await createCall({
        title: title.trim(),
        description: description.trim(),
        deadline: new Date(deadline).toISOString(),
        applicationCap: Number(cap),
      });
      toast.success(
        'La convocatoria quedó en borrador. Publícala para recibir postulaciones.',
        'Convocatoria creada',
      );
      setTitle('');
      setDescription('');
      setDeadline('');
      setCap('10');
      setErrors({});
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

  async function runAction(
    call: Call,
    action: 'publish' | 'close',
  ) {
    setWorkingId(call.callId);
    try {
      if (action === 'publish') {
        await publishCall(Number(call.callId));
        toast.success(
          'La convocatoria está abierta y recibe postulaciones.',
          'Convocatoria publicada',
        );
      } else {
        await closeCall(Number(call.callId));
        toast.success(
          'Las postulaciones se detuvieron.',
          'Convocatoria cerrada',
        );
      }
      await reload();
    } catch (error) {
      const code = graphqlErrorCode(error);
      toast.error(
        code === 'CONFLICT'
          ? 'La convocatoria está cerrada y no puede reabrirse.'
          : error instanceof Error
            ? error.message
            : `No fue posible ${
                action === 'publish' ? 'publicar' : 'cerrar'
              } la convocatoria. Intenta de nuevo.`,
        action === 'publish' ? 'No se pudo publicar' : 'No se pudo cerrar',
      );
    } finally {
      setWorkingId(null);
      setPendingAction(null);
    }
  }

  if (!canManage) {
    return (
      <NoAccess
        title="Gestión de convocatorias reservada"
        description="Solo la administración puede crear, publicar y cerrar convocatorias institucionales."
        action={
          <ButtonLink href="/calls" variant="secondary">
            Ver convocatorias
          </ButtonLink>
        }
      />
    );
  }

  return (
    <div className="space-y-5">
      <Breadcrumbs
        items={[
          { label: 'Panel', href: '/dashboard' },
          { label: 'Convocatorias', href: '/calls' },
          { label: 'Gestión' },
        ]}
      />

      <PageHeader
        title="Gestión de convocatorias"
        description="Crea la convocatoria en borrador, publícala para abrir el registro y ciérrala cuando termine el periodo."
        actions={
          <ButtonLink href="/calls" variant="secondary" size="sm">
            Ver convocatorias públicas
          </ButtonLink>
        }
      />

      <form onSubmit={handleCreate} noValidate>
        <SectionCard
          title="Nueva convocatoria"
          description="El borrador no recibe postulaciones hasta que lo publiques."
        >
          <div className="space-y-4 px-5 py-4">
            <div>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[11px] text-muted">
                  Aparece como título público de la convocatoria.
                </span>
                <span className="text-[11px] tabular-nums text-muted">
                  {title.length} / {TITLE_MAX}
                </span>
              </div>
              <Input
                id="title"
                label="Título"
                required
                maxLength={TITLE_MAX}
                value={title}
                error={errors.title}
                onChange={(event) => {
                  setTitle(event.target.value);
                  setErrors((current) => ({ ...current, title: undefined }));
                }}
                placeholder="Convocatoria de Fondos de Investigación 2027"
                wrapperClassName="mt-1.5"
              />
            </div>

            <div>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[11px] text-muted">
                  Bases, requisitos y criterios de elegibilidad.
                </span>
                <span className="text-[11px] tabular-nums text-muted">
                  {description.length} / {DESCRIPTION_MAX}
                </span>
              </div>
              <Textarea
                id="description"
                label="Descripción"
                required
                rows={4}
                maxLength={DESCRIPTION_MAX}
                value={description}
                error={errors.description}
                onChange={(event) => {
                  setDescription(event.target.value);
                  setErrors((current) => ({
                    ...current,
                    description: undefined,
                  }));
                }}
                placeholder="Bases, requisitos y criterios de elegibilidad…"
                wrapperClassName="mt-1.5"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                id="deadline"
                label="Fecha y hora límite"
                type="datetime-local"
                required
                value={deadline}
                error={errors.deadline}
                onChange={(event) => {
                  setDeadline(event.target.value);
                  setErrors((current) => ({
                    ...current,
                    deadline: undefined,
                  }));
                }}
              />
              <Input
                id="cap"
                label="Cupo de postulaciones"
                type="number"
                required
                min={1}
                max={CAP_MAX}
                value={cap}
                error={errors.cap}
                hint={`Máximo ${CAP_MAX} postulaciones.`}
                onChange={(event) => {
                  setCap(event.target.value);
                  setErrors((current) => ({ ...current, cap: undefined }));
                }}
              />
            </div>

            <div className="flex justify-end">
              <Button type="submit" loading={creating}>
                {creating ? 'Creando borrador…' : 'Crear borrador'}
              </Button>
            </div>
          </div>
        </SectionCard>
      </form>

      {loadError && (
        <ErrorState
          className="min-h-[260px] justify-center bg-white"
          title="No pudimos cargar las convocatorias"
          description={loadError}
          onRetry={() => {
            setLoadError(null);
            setReloadKey((key) => key + 1);
          }}
        />
      )}

      {!loadError && (
        <section
          aria-labelledby="calls-heading"
          className="overflow-hidden rounded-xl border border-line bg-white"
        >
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
            <div>
              <h2 id="calls-heading" className="text-sm font-semibold text-ink">
                Convocatorias registradas
              </h2>
              <p className="mt-0.5 text-xs text-muted" aria-live="polite">
                {calls
                  ? `${calls.length} ${
                      calls.length === 1 ? 'convocatoria' : 'convocatorias'
                    }`
                  : 'Consultando convocatorias…'}
              </p>
            </div>
          </header>

          {calls === null && (
            <div aria-busy="true">
              <span className="sr-only">Cargando convocatorias…</span>
              <table className="w-full">
                <tbody>
                  <SkeletonRows rows={5} columns={5} />
                </tbody>
              </table>
            </div>
          )}

          {calls && calls.length === 0 && (
            <div className="p-5">
              <EmptyState
                icon={<Icon name="calls" className="h-5 w-5" />}
                title="Aún no hay convocatorias registradas"
                description="Crea la primera convocatoria con el formulario de arriba; quedará en borrador hasta que la publiques."
              />
            </div>
          )}

          {calls && calls.length > 0 && (
            <TableShell className="rounded-none border-0">
              <table className="w-full min-w-[900px] border-collapse">
                <caption className="sr-only">
                  Convocatorias con estado, cupo utilizado, fecha de cierre y
                  acciones disponibles
                </caption>
                <thead>
                  <tr className="border-b border-line bg-surface-2">
                    <Th className="px-5">Convocatoria</Th>
                    <Th>Estado</Th>
                    <Th>Cupo</Th>
                    <Th>Cierre</Th>
                    <Th className="px-5 text-right">Acciones</Th>
                  </tr>
                </thead>
                <tbody>
                  {calls.map((call) => {
                    const status = effectiveStatus(call);
                    const working = workingId === call.callId;

                    return (
                      <tr
                        key={call.callId}
                        className="border-b border-line/70 transition-colors duration-150 hover:bg-surface-2"
                      >
                        <Td className="px-5">
                          <span className="block max-w-[420px] text-[12.5px] font-medium text-ink">
                            {call.title}
                          </span>
                          <span className="mt-0.5 block max-w-[420px] truncate text-[11px] text-muted">
                            {call.description}
                          </span>
                        </Td>
                        <Td>
                          <Badge tone={STATUS_TONES[status] ?? 'neutral'}>
                            {CALL_STATUS_LABELS[status] ?? status}
                          </Badge>
                        </Td>
                        <Td className="whitespace-nowrap text-[12px] tabular-nums text-ink">
                          {call.applicationCount} / {call.applicationCap}
                        </Td>
                        <Td className="whitespace-nowrap text-[12px] text-muted">
                          {formatCallDate(call.deadline)}
                        </Td>
                        <Td className="px-5 text-right">
                          <div className="flex flex-wrap items-center justify-end gap-1.5">
                            <ButtonLink
                              href={`/calls/${call.callId}`}
                              size="sm"
                              variant="secondary"
                            >
                              Ver
                            </ButtonLink>
                            {call.status === 'DRAFT' && (
                              <Button
                                size="sm"
                                disabled={working}
                                loading={working}
                                onClick={() =>
                                  setPendingAction({
                                    call,
                                    action: 'publish',
                                  })
                                }
                              >
                                {working ? 'Publicando…' : 'Publicar'}
                              </Button>
                            )}
                            {call.status === 'OPEN' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={working}
                                loading={working}
                                className="text-danger hover:bg-danger-soft hover:text-danger"
                                onClick={() =>
                                  setPendingAction({ call, action: 'close' })
                                }
                              >
                                {working ? 'Cerrando…' : 'Cerrar'}
                              </Button>
                            )}
                          </div>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableShell>
          )}
        </section>
      )}

      <Alert tone="info" title="Estados de una convocatoria">
        <span className="font-medium text-ink">Borrador</span>: solo la
        administración la ve. <span className="font-medium text-ink">Abierta</span>
        : recibe postulaciones hasta el cupo o la fecha límite.{' '}
        <span className="font-medium text-ink">Cerrada</span>: no admite nuevas
        postulaciones y no puede reabrirse.
      </Alert>

      <ConfirmDialog
        open={pendingAction !== null}
        onClose={() => {
          if (workingId === null) {
            setPendingAction(null);
          }
        }}
        onConfirm={() => {
          if (pendingAction) {
            void runAction(pendingAction.call, pendingAction.action);
          }
        }}
        title={
          pendingAction?.action === 'close'
            ? 'Cerrar la convocatoria'
            : 'Publicar la convocatoria'
        }
        description={
          pendingAction ? (
            pendingAction.action === 'close' ? (
              <>
                «{pendingAction.call.title}» dejará de recibir postulaciones de
                inmediato. Una convocatoria cerrada no puede reabrirse.
              </>
            ) : (
              <>
                «{pendingAction.call.title}» quedará visible para todos los
                investigadores y recibirá postulaciones hasta el cupo o la fecha
                límite.
              </>
            )
          ) : null
        }
        confirmLabel={
          pendingAction?.action === 'close' ? 'Cerrar convocatoria' : 'Publicar'
        }
        cancelLabel="Cancelar"
        tone={pendingAction?.action === 'close' ? 'danger' : 'primary'}
        loading={workingId !== null}
      />
    </div>
  );
}
