'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useToast } from '@/components/ui/toast-provider';
import { ConfirmDialog } from '@/components/ui/modal';
import {
  MILESTONE_STATUS_LABELS,
  assignMilestone,
  createMilestone,
  deleteMilestone,
  fetchProjectMilestones,
  milestoneErrorMessage,
  updateMilestone,
  updateMilestoneProgress,
  type Milestone,
} from '@/lib/milestones';
import {
  PROJECT_ROLE_LABELS,
  fetchTeamMembers,
  type TeamMember,
} from '@/lib/teams';

function dateInput(value: string): string {
  return new Date(value).toISOString().slice(0, 10);
}

/**
 * CRUD y seguimiento de hitos.
 * El backend aplica las reglas de retrasos y avisos y bloquea la escritura en
 * proyectos archivados.
 */
export function MilestonesPanel({
  projectId,
  canManage,
  currentUserId,
  readOnly = false,
}: {
  projectId: number;
  canManage: boolean;
  currentUserId: string;
  readOnly?: boolean;
}) {
  const toast = useToast();
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [editing, setEditing] = useState<{
    id: number;
    name: string;
    dueDate: string;
  } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Milestone | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rows, team] = await Promise.all([
        fetchProjectMilestones(projectId),
        fetchTeamMembers(projectId),
      ]);
      setMilestones(rows);
      setMembers(team);
      setAssigneeId((current) => current || (team[0]?.userId ?? ''));
    } catch (loadError: unknown) {
      setError(milestoneErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!assigneeId) {
      toast.error('Selecciona un integrante del equipo.');
      return;
    }
    setCreating(true);
    try {
      const milestone = await createMilestone({
        projectId,
        name: name.trim(),
        assigneeId,
        dueDate,
      });
      setMilestones((current) =>
        [...current, milestone].sort((a, b) =>
          a.dueDate.localeCompare(b.dueDate),
        ),
      );
      setName('');
      setDueDate('');
      toast.success('Hito creado y asignado.');
    } catch (createError: unknown) {
      toast.error(milestoneErrorMessage(createError));
    } finally {
      setCreating(false);
    }
  }

  async function handleProgress(
    milestone: Milestone,
    status: 'Pending' | 'Completed',
  ) {
    setBusyId(milestone.milestoneId);
    try {
      const updated = await updateMilestoneProgress(
        milestone.milestoneId,
        status,
      );
      setMilestones((current) =>
        current.map((item) =>
          item.milestoneId === updated.milestoneId ? updated : item,
        ),
      );
      toast.success(
        status === 'Completed' ? 'Hito completado.' : 'Hito reabierto.',
      );
    } catch (progressError: unknown) {
      toast.error(milestoneErrorMessage(progressError));
    } finally {
      setBusyId(null);
    }
  }

  async function handleAssign(milestone: Milestone, nextAssignee: string) {
    setBusyId(milestone.milestoneId);
    try {
      const updated = await assignMilestone(milestone.milestoneId, nextAssignee);
      setMilestones((current) =>
        current.map((item) =>
          item.milestoneId === updated.milestoneId ? updated : item,
        ),
      );
      toast.success('Hito reasignado.');
    } catch (assignError: unknown) {
      toast.error(milestoneErrorMessage(assignError));
    } finally {
      setBusyId(null);
    }
  }

  async function handleSaveEdit() {
    if (!editing) {
      return;
    }
    setBusyId(editing.id);
    try {
      const updated = await updateMilestone(editing.id, {
        name: editing.name.trim(),
        dueDate: editing.dueDate,
      });
      setMilestones((current) =>
        current
          .map((item) =>
            item.milestoneId === updated.milestoneId ? updated : item,
          )
          .sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
      );
      setEditing(null);
      toast.success('Hito actualizado.');
    } catch (updateError: unknown) {
      toast.error(milestoneErrorMessage(updateError));
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) {
      return;
    }
    const milestone = pendingDelete;
    setPendingDelete(null);
    setBusyId(milestone.milestoneId);
    try {
      await deleteMilestone(milestone.milestoneId);
      setMilestones((current) =>
        current.filter((item) => item.milestoneId !== milestone.milestoneId),
      );
      toast.success('Hito eliminado.');
    } catch (deleteError: unknown) {
      toast.error(milestoneErrorMessage(deleteError));
    } finally {
      setBusyId(null);
    }
  }

  if (pendingDelete) {
    return (
      <div className="space-y-6">
        <ConfirmDialog
          open
          onClose={() => setPendingDelete(null)}
          onConfirm={() => void confirmDelete()}
          title="Eliminar hito"
          description={
            <>
              Vas a eliminar «{pendingDelete.name}». Esta acción no se puede
              deshacer.
            </>
          }
          confirmLabel="Eliminar hito"
          cancelLabel="Cancelar"
          tone="danger"
          loading={busyId === pendingDelete.milestoneId}
        />
      </div>
    );
  }

  if (loading) {
    return <p className="text-sm text-muted">Cargando hitos…</p>;
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        <p>{error}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-2 rounded-md border border-red-300 px-3 py-1 text-xs font-medium"
        >
          Reintentar
        </button>
      </div>
    );
  }

  const completed = milestones.filter(
    (item) => item.status === 'Completed',
  ).length;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Hitos totales" value={milestones.length} />
        <Stat label="Completados" value={completed} />
        <Stat
          label="Retrasados"
          value={
            milestones.filter((item) => item.status === 'Delayed').length
          }
          tone="alert"
        />
      </div>

      {canManage && (
        <section className="rounded-xl border border-line bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-ink">Nuevo hito</h3>
          {readOnly ? (
            <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              El proyecto esta archivado; no admite nuevos hitos.
            </p>
          ) : (
            <form
              onSubmit={handleCreate}
              className="mt-3 grid gap-3 md:grid-cols-[1.4fr_1fr_0.8fr_auto]"
            >
              <label className="block text-xs font-medium text-ink">
                Nombre del hito
                <input
                  required
                  maxLength={150}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm text-ink focus:border-brand-400 focus:outline-none"
                  placeholder="Entrega de avance trimestral"
                />
              </label>
              <label className="block text-xs font-medium text-ink">
                Responsable
                <select
                  value={assigneeId}
                  onChange={(event) => setAssigneeId(event.target.value)}
                  className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink focus:border-brand-400 focus:outline-none"
                >
                  {members.map((member) => (
                    <option key={member.userId} value={member.userId}>
                      {member.name} ·{' '}
                      {PROJECT_ROLE_LABELS[member.projectRole] ??
                        member.projectRole}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-medium text-ink">
                Fecha compromiso
                <input
                  required
                  type="date"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                  className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm text-ink focus:border-brand-400 focus:outline-none"
                />
              </label>
              <button
                type="submit"
                disabled={creating || !name.trim() || !dueDate}
                className="mt-5 h-9 rounded-md bg-brand-700 px-4 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50"
              >
                {creating ? 'Creando…' : 'Crear hito'}
              </button>
            </form>
          )}
        </section>
      )}

      <section className="overflow-hidden rounded-xl border border-line bg-white shadow-sm">
        <header className="border-b border-line px-5 py-3">
          <h3 className="text-sm font-semibold text-ink">Hitos del proyecto</h3>
        </header>
        {milestones.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted">
            El proyecto aun no tiene hitos registrados.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {milestones.map((milestone) => {
              const canReport =
                !readOnly &&
                (canManage || milestone.assigneeId === currentUserId);
              const isBusy = busyId === milestone.milestoneId;
              return (
                <li key={milestone.milestoneId} className="px-5 py-4">
                  {editing?.id === milestone.milestoneId ? (
                    <div className="grid gap-3 md:grid-cols-[1.5fr_0.8fr_auto_auto]">
                      <input
                        value={editing.name}
                        maxLength={150}
                        onChange={(event) =>
                          setEditing({ ...editing, name: event.target.value })
                        }
                        className="rounded-md border border-line px-3 py-2 text-sm"
                      />
                      <input
                        type="date"
                        value={editing.dueDate}
                        onChange={(event) =>
                          setEditing({
                            ...editing,
                            dueDate: event.target.value,
                          })
                        }
                        className="rounded-md border border-line px-3 py-2 text-sm"
                      />
                      <button
                        type="button"
                        disabled={isBusy || !editing.name.trim()}
                        onClick={() => void handleSaveEdit()}
                        className="rounded-md bg-brand-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        Guardar
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditing(null)}
                        className="rounded-md border border-line px-3 py-2 text-xs font-medium text-ink"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ink">
                          {milestone.name}
                        </p>
                        <p className="mt-0.5 text-xs text-muted">
                          Responsable: {milestone.assigneeName} · Compromiso:{' '}
                          {new Date(milestone.dueDate).toLocaleDateString(
                            'es-MX',
                          )}
                        </p>
                      </div>
                      <span
                        className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                          milestone.status === 'Completed'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                            : milestone.status === 'Delayed'
                              ? 'border-red-200 bg-red-50 text-red-700'
                              : 'border-amber-200 bg-amber-50 text-amber-800'
                        }`}
                      >
                        {MILESTONE_STATUS_LABELS[milestone.status]}
                      </span>
                    </div>
                  )}

                  {editing?.id !== milestone.milestoneId && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {canManage && !readOnly && (
                        <select
                          aria-label={`Responsable de ${milestone.name}`}
                          value={milestone.assigneeId}
                          disabled={isBusy}
                          onChange={(event) =>
                            void handleAssign(milestone, event.target.value)
                          }
                          className="rounded-md border border-line bg-white px-2 py-1 text-xs text-ink"
                        >
                          {members.map((member) => (
                            <option key={member.userId} value={member.userId}>
                              {member.name}
                            </option>
                          ))}
                        </select>
                      )}
                      {canReport && milestone.status !== 'Completed' && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() =>
                            void handleProgress(milestone, 'Completed')
                          }
                          className="rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
                        >
                          Marcar completado
                        </button>
                      )}
                      {canReport && milestone.status === 'Completed' && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void handleProgress(milestone, 'Pending')}
                          className="rounded-md border border-line px-2.5 py-1 text-xs font-medium text-ink hover:bg-surface disabled:opacity-50"
                        >
                          Reabrir
                        </button>
                      )}
                      {canManage && !readOnly && (
                        <>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() =>
                              setEditing({
                                id: milestone.milestoneId,
                                name: milestone.name,
                                dueDate: dateInput(milestone.dueDate),
                              })
                            }
                            className="rounded-md border border-line px-2.5 py-1 text-xs font-medium text-ink hover:bg-surface"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => setPendingDelete(milestone)}
                            className="rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                          >
                            Eliminar
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: number;
  tone?: 'default' | 'alert';
}) {
  return (
    <div className="rounded-xl border border-line bg-white p-4 shadow-sm">
      <p className="text-xs text-muted">{label}</p>
      <p
        className={`mt-1 text-xl font-semibold ${
          tone === 'alert' && value > 0 ? 'text-red-700' : 'text-ink'
        }`}
      >
        {value}
      </p>
    </div>
  );
}
