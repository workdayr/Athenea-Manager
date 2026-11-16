/** F2-07 / RF-006 / BR-008: hitos, retrasos y avisos de vencimiento. */

export const MILESTONE_ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  INVALID_ASSIGNEE: 'INVALID_ASSIGNEE',
  MILESTONE_HAS_EVIDENCE: 'MILESTONE_HAS_EVIDENCE',
  PROJECT_ARCHIVED: 'PROJECT_ARCHIVED',
} as const;

export const MILESTONE_NAME_MAX_LENGTH = 150;
export const MILESTONE_DELAY_DAYS_DEFAULT = 7;
export const MILESTONE_SCAN_INTERVAL_DEFAULT_MS = 24 * 60 * 60 * 1000;
export const MILESTONE_SCAN_INITIAL_DELAY_MS = 60 * 1000;
export const MILESTONE_SCAN_BATCH_SIZE = 200;

/** BR-008: avisos previos al vencimiento, de mayor a menor. */
export const MILESTONE_NOTICE_DAYS = [30, 15, 5] as const;

export function resolveMilestoneDelayDays(
  env: NodeJS.ProcessEnv = process.env,
): number {
  const parsed = Number(env['MILESTONE_DELAY_DAYS']);
  return Number.isFinite(parsed) && parsed > 0
    ? Math.trunc(parsed)
    : MILESTONE_DELAY_DAYS_DEFAULT;
}

export function resolveMilestoneScanIntervalMs(
  env: NodeJS.ProcessEnv = process.env,
): number {
  const parsed = Number(env['MILESTONE_SCAN_INTERVAL_MS']);
  return Number.isFinite(parsed) && parsed > 0
    ? Math.trunc(parsed)
    : MILESTONE_SCAN_INTERVAL_DEFAULT_MS;
}

export function validateMilestoneName(name: string | null | undefined): string {
  const value = (name ?? '').trim();
  if (value.length === 0) {
    throw new Error('El nombre del hito es obligatorio.');
  }
  if (value.length > MILESTONE_NAME_MAX_LENGTH) {
    throw new Error(
      `El nombre del hito no puede exceder ${MILESTONE_NAME_MAX_LENGTH} caracteres.`,
    );
  }
  return value;
}

/**
 * Las columnas `@db.Date` llegan de Prisma como medianoche UTC. Se compara
 * en UTC para que un proyecto en America/Mexico_City no vea el vencimiento
 * un dia antes por el desfase de zona horaria.
 */
function startOfUtcDay(date: Date): number {
  return Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  );
}

/**
 * Devuelve el umbral de aviso que corresponde a la fecha compromiso:
 * 30, 15 o 5 dias antes; 0 si aun falta mas de un mes o ya vencio.
 */
export function dueNoticeThreshold(
  dueDate: Date,
  now: Date = new Date(),
): number {
  const due = startOfUtcDay(new Date(dueDate));
  const today = startOfUtcDay(now);
  const daysLeft = Math.round((due - today) / (24 * 60 * 60 * 1000));
  if (daysLeft < 0) {
    return 0;
  }
  // Se elige el aviso mas cercano que aun no haya pasado: si el job corre
  // por primera vez a 14 dias, corresponde el aviso de 15 y no el de 30.
  for (const threshold of [...MILESTONE_NOTICE_DAYS].reverse()) {
    if (daysLeft <= threshold) {
      return threshold;
    }
  }
  return 0;
}

/** Dias de retraso de una tarea vencida (0 si aun no vence). */
export function daysOverdue(dueDate: Date, now: Date = new Date()): number {
  const due = startOfUtcDay(new Date(dueDate));
  const today = startOfUtcDay(now);
  return Math.max(0, Math.round((today - due) / (24 * 60 * 60 * 1000)));
}
