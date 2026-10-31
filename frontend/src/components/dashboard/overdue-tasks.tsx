import { daysUntil, formatDate, type DashboardTask } from '@/lib/dashboard';

/** RF-006: a partir de 7 dias de retraso el entregable se marca critico. */
const CRITICAL_DAYS_LATE = 7;

/**
 * Misma regla que el contador "Entregables en riesgo" del panel:
 * no completada y con fecha limite vencida.
 */
export function isOverdue(task: DashboardTask): boolean {
  return task.status !== 'Completed' && daysUntil(task.dueDate) < 0;
}

/**
 * US 5.1: lista cuales tareas estan atrasadas (el contador solo decia
 * cuantas). Ordenadas de mayor a menor retraso.
 */
export function OverdueTasks({ tasks }: { tasks: DashboardTask[] }) {
  const overdue = tasks
    .filter(isOverdue)
    .map((task) => ({ task, daysLate: Math.abs(daysUntil(task.dueDate)) }))
    .sort((a, b) => b.daysLate - a.daysLate);

  return (
    <section
      aria-label="Tareas atrasadas"
      className="rounded-xl border border-line bg-white p-5 shadow-[0_1px_2px_rgba(16,35,61,0.04)]"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[17px] font-semibold tracking-tight text-ink">
            Tareas atrasadas
          </h2>
          <p className="mt-1 text-[11.5px] text-muted">
            Entregables no completados cuya fecha límite ya venció
          </p>
        </div>
        <span
          className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
            overdue.length > 0
              ? 'border-red-200 bg-red-50 text-red-700'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700'
          }`}
        >
          {overdue.length} {overdue.length === 1 ? 'atrasada' : 'atrasadas'}
        </span>
      </div>

      {overdue.length === 0 ? (
        <p className="mt-3 rounded-lg border border-line bg-[#f8f9fd] px-3 py-5 text-center text-[11.5px] text-muted">
          Sin tareas atrasadas.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {overdue.map(({ task, daysLate }) => (
            <li
              key={task.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-100 bg-red-50/40 px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-[12.5px] font-medium text-ink">
                  {task.title}
                </p>
                <p className="mt-0.5 text-[10.5px] text-muted">
                  {task.assignee === 'me' ? 'Tú' : (task.assigneeName ?? 'Equipo')}{' '}
                  · vencía el {formatDate(task.dueDate)}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {daysLate >= CRITICAL_DAYS_LATE && (
                  <span className="rounded-full border border-red-300 bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-800">
                    Crítica
                  </span>
                )}
                <span className="rounded-full border border-red-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-red-700">
                  {daysLate} {daysLate === 1 ? 'día' : 'días'} de atraso
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
