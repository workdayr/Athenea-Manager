'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { getApolloClient } from '@/lib/apollo-client';
import {
  CREATE_MILESTONE_MUTATION,
  dateInputToIso,
  PROJECT_ROLE_LABELS,
  PROJECT_TEAM_QUERY,
  todayInputValue,
  type TeamMember,
} from '@/lib/milestone-planning';

const fieldClassName =
  'h-9 w-full rounded-md border border-line bg-white px-3 text-xs text-ink placeholder:text-muted focus:border-brand-700 focus:outline-none';

/**
 * US 5.1: el Investigador Principal planifica un hito del proyecto.
 *
 * Todo hito nace Pendiente (no hay selector de estado) y el responsable se
 * elige solo entre el equipo del proyecto. El backend valida de nuevo rol,
 * pertenencia y fecha.
 */
export function MilestonePlanner({
  projectId,
  onCreated,
}: {
  projectId: number;
  onCreated: () => void;
}) {
  // getApolloClient() crea una instancia nueva en cada llamada: se memoiza.
  const client = useMemo(() => getApolloClient(), []);

  const [team, setTeam] = useState<TeamMember[]>([]);
  const [name, setName] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    client
      .query<{ projectTeam: TeamMember[] }>({
        query: PROJECT_TEAM_QUERY,
        variables: { projectId },
        fetchPolicy: 'network-only',
      })
      .then((result) => {
        if (active) {
          setTeam(result.data?.projectTeam ?? []);
        }
      })
      .catch(() => {
        if (active) {
          setError('No fue posible cargar el equipo del proyecto.');
        }
      });
    return () => {
      active = false;
    };
  }, [client, projectId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    if (!name.trim() || !assigneeId || !dueDate) {
      setError('Nombre, responsable y fecha límite son obligatorios.');
      return;
    }
    setSaving(true);
    try {
      await client.mutate({
        mutation: CREATE_MILESTONE_MUTATION,
        variables: {
          input: {
            projectId,
            name: name.trim(),
            assigneeId,
            dueDate: dateInputToIso(dueDate),
          },
        },
      });
      setSuccess(`Hito "${name.trim()}" creado como Pendiente.`);
      setName('');
      setDueDate('');
      onCreated();
    } catch (mutationError: unknown) {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : 'No fue posible crear el hito.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-line bg-white p-5 shadow-[0_1px_2px_rgba(16,35,61,0.04)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[17px] font-semibold tracking-tight text-ink">
            Planificar nuevo hito
          </h2>
          <p className="mt-1 text-[11.5px] text-muted">
            Asigna un entregable a un integrante del equipo. Se crea como
            Pendiente y se completa al subir su evidencia.
          </p>
        </div>
        <span className="rounded-full border border-line bg-[#f8f9fd] px-2.5 py-1 text-[10px] font-medium text-muted">
          US 5.1
        </span>
      </div>

      <form
        onSubmit={handleSubmit}
        className="mt-4 grid gap-3 md:grid-cols-[2fr_1.4fr_1fr_auto]"
      >
        <input
          className={fieldClassName}
          placeholder="Nombre del hito"
          maxLength={150}
          value={name}
          onChange={(event) => setName(event.target.value)}
          aria-label="Nombre del hito"
        />
        <select
          className={fieldClassName}
          value={assigneeId}
          onChange={(event) => setAssigneeId(event.target.value)}
          aria-label="Responsable"
        >
          <option value="">Responsable…</option>
          {team.map((member) => (
            <option key={member.userId} value={member.userId}>
              {member.name} ·{' '}
              {PROJECT_ROLE_LABELS[member.projectRole] ?? member.projectRole}
            </option>
          ))}
        </select>
        <input
          type="date"
          className={fieldClassName}
          min={todayInputValue()}
          value={dueDate}
          onChange={(event) => setDueDate(event.target.value)}
          aria-label="Fecha límite"
        />
        <button
          type="submit"
          disabled={saving}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-brand-900 px-3.5 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? 'Creando…' : 'Crear hito'}
        </button>
      </form>

      {error && (
        <p
          role="alert"
          className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[11.5px] text-red-700"
        >
          {error}
        </p>
      )}
      {success && (
        <p
          role="status"
          className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11.5px] text-emerald-700"
        >
          {success}
        </p>
      )}
    </section>
  );
}
