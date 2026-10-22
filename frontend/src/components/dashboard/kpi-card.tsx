import { Icon } from './icons';
import type { InstitutionalKpi } from '@/lib/dashboard';

/**
 * Tarjeta KPI del tablero institucional (RF-008).
 * `tone="danger"` se usa para indicadores de riesgo (hitos vencidos).
 */
export function KpiCard({ kpi }: { kpi: InstitutionalKpi }) {
  const tone =
    kpi.id === 'risk'
      ? {
          value: 'text-red-600',
          caption: 'text-red-600',
          icon: 'bg-red-50 text-red-500',
        }
      : {
          value: 'text-ink',
          caption: 'text-muted',
          icon: 'bg-brand-50 text-brand-600',
        };

  return (
    <article className="flex flex-col rounded-xl border border-line bg-white p-5 shadow-[0_1px_2px_rgba(16,35,61,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[10.5px] font-semibold uppercase leading-snug tracking-[0.06em] text-muted">
          {kpi.label}
        </p>
        <span
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-md ${tone.icon}`}
        >
          <Icon name={kpi.icon} className="h-4 w-4" />
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-x-2 gap-y-1">
        <p
          className={`text-[32px] font-semibold leading-none tracking-tight ${tone.value}`}
        >
          {kpi.value}
        </p>
        {kpi.delta && (
          <span className="mb-1 inline-flex items-center gap-0.5 text-[11px] font-medium text-emerald-600">
            <Icon name="arrowUpRight" className="h-3 w-3" />
            {kpi.delta}
          </span>
        )}
      </div>

      <p className={`mt-1 text-[11px] font-medium ${tone.caption}`}>
        {kpi.caption}
      </p>

      {kpi.chips && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {kpi.chips.map((chip) => (
            <span
              key={`${chip.label}-${chip.value}`}
              className="flex items-center gap-1 rounded border border-line bg-[#f8f9fd] px-2 py-1 text-[10px] text-muted"
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
              <span className="font-medium text-ink">
                {kpi.progress.suffix}
              </span>
            )}
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#e8edf7]">
            <div
              className="h-full rounded-full bg-brand-600"
              style={{ width: `${Math.min(100, Math.max(0, kpi.progress.percent))}%` }}
            />
          </div>
        </div>
      )}

      {kpi.alert && (
        <p className="mt-4 rounded-md border border-red-100 bg-red-50 px-2.5 py-2 text-[10.5px] leading-snug text-red-800">
          {kpi.alert}
        </p>
      )}
    </article>
  );
}
