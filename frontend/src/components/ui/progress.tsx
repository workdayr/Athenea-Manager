import { cn } from '@/lib/cn';

const TONES = {
  brand: 'bg-brand-600',
  success: 'bg-success',
  warning: 'bg-amber-500',
  danger: 'bg-danger',
} as const;

/**
 * Barra de progreso accesible. El ancho se anima al cambiar de valor para
 * que la actualización se lea como movimiento y no como un salto.
 */
export function ProgressBar({
  value,
  max = 100,
  tone = 'brand',
  label,
  size = 'md',
  className,
}: {
  value: number;
  max?: number;
  tone?: keyof typeof TONES;
  label: string;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const safeMax = max > 0 ? max : 100;
  const clamped = Math.min(100, Math.max(0, (value / safeMax) * 100));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
      className={cn(
        'w-full overflow-hidden rounded-full bg-surface-3',
        size === 'sm' ? 'h-1.5' : 'h-2',
        className,
      )}
    >
      <div
        className={cn(
          'h-full rounded-full transition-[width] duration-500 ease-snappy',
          TONES[tone],
        )}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
