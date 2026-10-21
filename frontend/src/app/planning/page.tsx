'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { authClient } from '@/lib/auth-client';
import { getApolloClient } from '@/lib/apollo-client';
import {
  CREATE_MILESTONE_MUTATION,
  CREATE_TASK_MUTATION,
  dateInputToIso,
  formatDueDate,
  MILESTONES_BY_PROJECT_QUERY,
  PROJECT_ROLE_LABELS,
  PROJECT_TEAM_QUERY,
  STATUS_LABELS,
  STATUSES,
  TASKS_BY_MILESTONE_QUERY,
  type Milestone,
  type Task,
  type TeamMember,
} from '@/lib/planning';

const inputClassName =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:border-blue-600 focus:outline-none';
const cardClassName =
  'mt-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm';
const buttonClassName =
  'rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60';

type TasksByMilestone = Record<number, Task[]>;

/**
 * US 5.1: pantalla de prueba para planificar hitos y tareas.
 * Crear (hitos/tareas) solo se ofrece al Investigador Principal; el backend
 * valida de todos modos que sea PI de ESE proyecto y que el responsable
 * pertenezca al equipo.
 */
export default function PlanningPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [role, setRole] = useState<string | undefined>();

  const [projectInput, setProjectInput] = useState('');
  const [projectId, setProjectId] = useState<number | null>(null);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [tasks, setTasks] = useState<TasksByMilestone>({});
  const [loading, setLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Formulario de hito
  const [msName, setMsName] = useState('');
  const [msAssignee, setMsAssignee] = useState('');
  const [msDue, setMsDue] = useState('');
  const [msStatus, setMsStatus] = useState<string>('Pending');

  // Formulario de tarea
  const [taskMilestone, setTaskMilestone] = useState('');
  const [taskName, setTaskName] = useState('');
  const [taskAssignee, setTaskAssignee] = useState('');
  const [taskDue, setTaskDue] = useState('');
  const [taskStatus, setTaskStatus] = useState<string>('Pending');

  const canCreate = role === 'PRINCIPAL_INVESTIGATOR';

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
      setRole((data.user as { role?: string }).role);
      setChecking(false);
    });
    return () => {
      active = false;
    };
  }, [router]);

  async function loadProject(id: number) {
    setLoading(true);
    setError(null);
    try {
      const client = getApolloClient();
      const [teamResult, milestonesResult] = await Promise.all([
        client.query<{ projectTeam: TeamMember[] }>({
          query: PROJECT_TEAM_QUERY,
          variables: { projectId: id },
          fetchPolicy: 'network-only',
        }),
        client.query<{ milestonesByProject: Milestone[] }>({
          query: MILESTONES_BY_PROJECT_QUERY,
          variables: { projectId: id },
          fetchPolicy: 'network-only',
        }),
      ]);
      const loadedMilestones = milestonesResult.data?.milestonesByProject ?? [];
      const taskResults = await Promise.all(
        loadedMilestones.map((milestone) =>
          client.query<{ tasksByMilestone: Task[] }>({
            query: TASKS_BY_MILESTONE_QUERY,
            variables: { milestoneId: milestone.milestoneId },
            fetchPolicy: 'network-only',
          }),
        ),
      );
      const grouped: TasksByMilestone = {};
      loadedMilestones.forEach((milestone, index) => {
        grouped[milestone.milestoneId] =
          taskResults[index].data?.tasksByMilestone ?? [];
      });
      setTeam(teamResult.data?.projectTeam ?? []);
      setMilestones(loadedMilestones);
      setTasks(grouped);
      setProjectId(id);
    } catch (loadError: unknown) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'No fue posible cargar el proyecto.',
      );
    } finally {
      setLoading(false);
    }
  }

  function handleLoad(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSuccess(null);
    const id = Number(projectInput);
    if (!Number.isInteger(id) || id <= 0) {
      setError('Ingresa un ID de proyecto válido (número entero).');
      return;
    }
    void loadProject(id);
  }

  async function handleCreateMilestone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (projectId === null) {
      return;
    }
    setError(null);
    setSuccess(null);
    if (!msName.trim() || !msAssignee || !msDue) {
      setError('Nombre, responsable y fecha límite son obligatorios.');
      return;
    }
    setSaving(true);
    try {
      await getApolloClient().mutate({
        mutation: CREATE_MILESTONE_MUTATION,
        variables: {
          input: {
            projectId,
            name: msName.trim(),
            assigneeId: msAssignee,
            dueDate: dateInputToIso(msDue),
            status: msStatus,
          },
        },
      });
      setSuccess(`Hito "${msName.trim()}" creado.`);
      setMsName('');
      setMsDue('');
      await loadProject(projectId);
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

  async function handleCreateTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (projectId === null) {
      return;
    }
    setError(null);
    setSuccess(null);
    if (!taskMilestone || !taskName.trim() || !taskAssignee || !taskDue) {
      setError('Hito, nombre, responsable y fecha límite son obligatorios.');
      return;
    }
    setSaving(true);
    try {
      await getApolloClient().mutate({
        mutation: CREATE_TASK_MUTATION,
        variables: {
          input: {
            milestoneId: Number(taskMilestone),
            name: taskName.trim(),
            assigneeId: taskAssignee,
            dueDate: dateInputToIso(taskDue),
            status: taskStatus,
          },
        },
      });
      setSuccess(`Tarea "${taskName.trim()}" creada.`);
      setTaskName('');
      setTaskDue('');
      await loadProject(projectId);
    } catch (mutationError: unknown) {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : 'No fue posible crear la tarea.',
      );
    } finally {
      setSaving(false);
    }
  }

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-600">Verificando sesión…</p>
      </main>
    );
  }

  const assigneeOptions = team.map((member) => (
    <option key={member.userId} value={member.userId}>
      {member.name} ·{' '}
      {PROJECT_ROLE_LABELS[member.projectRole] ?? member.projectRole}
    </option>
  ));

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto w-full max-w-3xl">
        <Link href="/dashboard" className="text-sm text-blue-700">
          ← Volver al panel
        </Link>
        <p className="mt-3 text-xs font-medium text-blue-700">
          PLANIFICACIÓN · US 5.1
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-gray-900">
          Hitos y tareas del proyecto
        </h1>

        <form
          onSubmit={handleLoad}
          className="mt-4 flex items-end gap-3 rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
        >
          <label className="flex-1 text-sm text-gray-700">
            ID del proyecto
            <input
              type="number"
              min={1}
              value={projectInput}
              onChange={(event) => setProjectInput(event.target.value)}
              className={`${inputClassName} mt-1`}
              placeholder="Ej. 1"
            />
          </label>
          <button type="submit" disabled={loading} className={buttonClassName}>
            {loading ? 'Cargando…' : 'Cargar'}
          </button>
        </form>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </p>
        )}
        {success && (
          <p
            role="status"
            className="mt-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800"
          >
            {success}
          </p>
        )}

        {projectId !== null && (
          <>
            <section className={cardClassName}>
              <h2 className="text-lg font-semibold text-gray-900">
                Equipo del proyecto #{projectId}
              </h2>
              <ul className="mt-2 space-y-1 text-sm">
                {team.map((member) => (
                  <li
                    key={member.userId}
                    className="flex justify-between gap-4"
                  >
                    <span className="font-medium text-gray-900">
                      {member.name}
                    </span>
                    <span className="text-gray-500">
                      {PROJECT_ROLE_LABELS[member.projectRole] ??
                        member.projectRole}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            {canCreate ? (
              <>
                <section className={cardClassName}>
                  <h2 className="text-lg font-semibold text-gray-900">
                    Nuevo hito
                  </h2>
                  <form
                    onSubmit={handleCreateMilestone}
                    className="mt-3 grid gap-3 sm:grid-cols-2"
                  >
                    <input
                      className={`${inputClassName} sm:col-span-2`}
                      placeholder="Nombre del hito"
                      maxLength={150}
                      value={msName}
                      onChange={(event) => setMsName(event.target.value)}
                    />
                    <select
                      className={inputClassName}
                      value={msAssignee}
                      onChange={(event) => setMsAssignee(event.target.value)}
                    >
                      <option value="">Responsable…</option>
                      {assigneeOptions}
                    </select>
                    <input
                      type="date"
                      className={inputClassName}
                      value={msDue}
                      onChange={(event) => setMsDue(event.target.value)}
                    />
                    <select
                      className={inputClassName}
                      value={msStatus}
                      onChange={(event) => setMsStatus(event.target.value)}
                    >
                      {STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {STATUS_LABELS[status]}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      disabled={saving}
                      className={buttonClassName}
                    >
                      Crear hito
                    </button>
                  </form>
                </section>

                <section className={cardClassName}>
                  <h2 className="text-lg font-semibold text-gray-900">
                    Nueva tarea
                  </h2>
                  <form
                    onSubmit={handleCreateTask}
                    className="mt-3 grid gap-3 sm:grid-cols-2"
                  >
                    <select
                      className={`${inputClassName} sm:col-span-2`}
                      value={taskMilestone}
                      onChange={(event) => setTaskMilestone(event.target.value)}
                    >
                      <option value="">Hito…</option>
                      {milestones.map((milestone) => (
                        <option
                          key={milestone.milestoneId}
                          value={milestone.milestoneId}
                        >
                          {milestone.name}
                        </option>
                      ))}
                    </select>
                    <input
                      className={`${inputClassName} sm:col-span-2`}
                      placeholder="Nombre de la tarea"
                      maxLength={150}
                      value={taskName}
                      onChange={(event) => setTaskName(event.target.value)}
                    />
                    <select
                      className={inputClassName}
                      value={taskAssignee}
                      onChange={(event) => setTaskAssignee(event.target.value)}
                    >
                      <option value="">Responsable…</option>
                      {assigneeOptions}
                    </select>
                    <input
                      type="date"
                      className={inputClassName}
                      value={taskDue}
                      onChange={(event) => setTaskDue(event.target.value)}
                    />
                    <select
                      className={inputClassName}
                      value={taskStatus}
                      onChange={(event) => setTaskStatus(event.target.value)}
                    >
                      {STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {STATUS_LABELS[status]}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      disabled={saving || milestones.length === 0}
                      className={buttonClassName}
                    >
                      Crear tarea
                    </button>
                  </form>
                </section>
              </>
            ) : (
              <p className="mt-4 text-sm text-gray-600">
                Solo el Investigador Principal puede crear hitos y tareas.
              </p>
            )}

            <section className={cardClassName}>
              <h2 className="text-lg font-semibold text-gray-900">
                Plan de ejecución
              </h2>
              {milestones.length === 0 ? (
                <p className="mt-2 text-sm text-gray-600">
                  Este proyecto aún no tiene hitos.
                </p>
              ) : (
                <ul className="mt-3 space-y-4">
                  {milestones.map((milestone) => (
                    <li
                      key={milestone.milestoneId}
                      className="rounded-lg border border-gray-200 p-4"
                    >
                      <div className="flex flex-wrap justify-between gap-2">
                        <span className="font-medium text-gray-900">
                          {milestone.name}
                        </span>
                        <span className="text-sm text-gray-600">
                          {STATUS_LABELS[milestone.status] ?? milestone.status}{' '}
                          · vence {formatDueDate(milestone.dueDate)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">
                        Responsable: {milestone.assigneeName}
                      </p>
                      <ul className="mt-2 space-y-1 border-t border-gray-100 pt-2 text-sm">
                        {(tasks[milestone.milestoneId] ?? []).length === 0 && (
                          <li className="text-gray-500">Sin tareas.</li>
                        )}
                        {(tasks[milestone.milestoneId] ?? []).map((task) => (
                          <li
                            key={task.taskId}
                            className="flex flex-wrap justify-between gap-2"
                          >
                            <span className="text-gray-900">
                              {task.name} · {task.assigneeName}
                            </span>
                            <span className="text-gray-600">
                              {STATUS_LABELS[task.status] ?? task.status} ·{' '}
                              {formatDueDate(task.dueDate)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
