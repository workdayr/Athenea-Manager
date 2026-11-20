import type { LifecycleModel } from '@/lib/dashboard';

interface LifecycleFunnelProps {
  model: LifecycleModel;
  /** Institucional: muestra conteos. Proyecto: muestra estado de la etapa. */
  mode: 'institutional' | 'project';
  /** Etapa resaltada (por defecto la etapa actual del modelo). */
  selectedId?: number | null;
  onSelect?: (phaseId: number) => void;
}

const STATE_LABELS = {
  done: 'Completado',
  current: 'En curso',
  upcoming: 'Pendiente',
} as const;

/**
 * Embudo del ciclo de vida. En el tablero institucional cada
 * etapa filtra la tabla de seguimiento; en la vista de proyecto marca
 * avance, etapa actual y etapas pendientes.
 */
export function LifecycleFunnel({
  model,
  mode,
  selectedId,
  onSelect,
}: LifecycleFunnelProps) {
  const highlighted = selectedId ?? model.currentId;

  return (
    <ol className="space-y-2">
      {model.steps.map((step) => {
        const isHighlighted = step.id === highlighted;
        const selected = selectedId === step.id;
        const numberStyles = isHighlighted
          ? 'border-brand-800 bg-brand-800 text-white'
          : step.state === 'done'
            ? 'border-success-line bg-success-soft text-success'
            : step.state === 'upcoming'
              ? 'border-line bg-white text-muted'
              : 'border-brand-200 bg-white text-brand-700';

        const content = (
          <>
            <span
              aria-hidden="true"
              className={`grid h-8 w-8 shrink-0 place-items-center rounded-md border text-[12px] font-semibold tabular-nums transition-colors duration-150 ${numberStyles}`}
            >
              {step.id}
            </span>
            <span className="min-w-0 flex-1">
              <span
                className={`block truncate text-[12.5px] ${
                  isHighlighted
                    ? 'font-semibold text-ink'
                    : 'font-medium text-ink/90'
                }`}
                title={step.name}
              >
                {step.name}
              </span>
              <span
                className="block truncate text-[10.5px] text-muted"
                title={step.description}
              >
                {step.description}
              </span>
            </span>
            {mode === 'institutional' && step.count !== undefined && (
              <span className="shrink-0 rounded-md border border-line bg-white px-2 py-0.5 text-[11px] font-semibold tabular-nums text-brand-800">
                {step.count}
              </span>
            )}
            {mode === 'project' && step.state && (
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide ${
                  step.state === 'done'
                    ? 'bg-success-soft text-success'
                    : step.state === 'current'
                      ? 'bg-brand-800 text-white'
                      : 'bg-surface-3 text-muted'
                }`}
              >
                {STATE_LABELS[step.state]}
              </span>
            )}
          </>
        );

        const className = `flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-[background-color,border-color,box-shadow] duration-150 ease-snappy ${
          isHighlighted
            ? 'border-brand-300 bg-brand-50'
            : 'border-line bg-surface-2'
        } ${
          onSelect
            ? 'cursor-pointer hover:border-brand-300 hover:bg-brand-50 focus-visible:outline-brand-400'
            : ''
        } ${selected ? 'border-brand-400 ring-1 ring-brand-200' : ''}`;

        if (!onSelect) {
          return (
            <li key={step.id} className={className}>
              {content}
            </li>
          );
        }

        return (
          <li key={step.id}>
            <button
              type="button"
              onClick={() => onSelect(step.id)}
              aria-pressed={selected}
              className={className}
            >
              {content}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
