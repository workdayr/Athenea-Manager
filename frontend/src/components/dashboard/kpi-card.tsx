import { Icon } from './icons';
import { ProgressBar } from '@/components/ui/progress';
import type { InstitutionalKpi } from '@/lib/dashboard';

/**
 * Tarjeta KPI del tablero institucional.
 * `risk` usa el tono de peligro del sistema (no un rojo suelto).
 */
export function KpiCard({ kpi }: { kpi: InstitutionalKpi }) {
  const risk = kpi.id === 'risk';

  // Un delta negativo no puede pintarse como mejora: se decide por el signo
  // del texto que entrega el backend.
  const negativeDelta = kpi.delta ? /^[\s−-]/.test(kpi.delta) : false;

  return (
    <article className="flex flex-col rounded-xl border border-line bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[10.5px] font-semibold uppercase leading-snug tracking-[0.06em] text-muted">
          {kpi.label}
        </p>
        <span
          aria-hidden="true"
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-md ${
            risk ? 'bg-danger-soft text-danger' : 'bg-brand-50 text-brand-600'
          }`}
        >
          <Icon name={kpi.icon} className="h-4 w-4" />
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-x-2 gap-y-1">
        <p
          className={`text-[32px] font-semibold leading-none tracking-tight tabular-nums ${
            risk ? 'text-danger' : 'text-ink'
          }`}
        >
          {kpi.value}
        </p>
        {kpi.delta && (
          <span
            className={`mb-1 inline-flex items-center gap-0.5 text-[11px] font-medium ${
              negativeDelta ? 'text-danger' : 'text-success'
            }`}
          >
            <Icon
              name={negativeDelta ? 'chevronDown' : 'arrowUpRight'}
              className="h-3 w-3"
            />
            {kpi.delta}
          </span>
        )}
      </div>

      <p
        className={`mt-1 text-[11px] font-medium ${
          risk ? 'text-danger' : 'text-muted'
        }`}
      >
        {kpi.caption}
      </p>

      {kpi.chips && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {kpi.chips.map((chip) => (
            <span
              key={`${chip.label}-${chip.value}`}
              className="flex items-center gap-1 rounded border border-line bg-surface-2 px-2 py-1 text-[10px] text-muted"
            >
              <strong className="font-semibold text-ink">{chip.label}</strong>
              {chip.value}
            </span>
          ))}
        </div>
      )}

      {kpi.progress && (
        <div className="mt-auto pt-4">
          <div className="flex items-center justify-between gap-2 text-[10px] text-muted">
            <span>
              {kpi.progress.prefix}{' '}
              <strong className="font-semibold text-ink">
                {kpi.progress.highlight}
              </strong>
            </span>
            {kpi.progress.suffix && (
              <span className="font-medium text-ink">{kpi.progress.suffix}</span>
            )}
          </div>
          <ProgressBar
            className="mt-1.5"
            label={kpi.label}
            size="sm"
            value={kpi.progress.percent}
          />
        </div>
      )}

      {kpi.alert && (
        <p className="mt-4 rounded-md border border-danger-line bg-danger-soft px-2.5 py-2 text-[10.5px] leading-snug text-danger">
          {kpi.alert}
        </p>
      )}
    </article>
  );
}
