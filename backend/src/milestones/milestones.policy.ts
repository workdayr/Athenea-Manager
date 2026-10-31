/**
 * US 5.1: reglas puras de planificacion de hitos (sin acceso a BD).
 */

export const MILESTONE_NAME_MAX_LENGTH = 150;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Nombre sin espacios sobrantes; `null` si queda vacio o excede el maximo. */
export function normalizeMilestoneName(value: string): string | null {
  const name = value.trim();
  if (name.length === 0 || name.length > MILESTONE_NAME_MAX_LENGTH) {
    return null;
  }
  return name;
}

/**
 * `true` si la fecha limite ya paso. Las fechas son de tipo DATE (00:00 UTC)
 * y el usuario puede estar en una zona horaria detras de UTC, asi que se
 * toleran 24 h: "hoy" local nunca se rechaza.
 */
export function isPastDueDate(dueDate: Date, now: Date = new Date()): boolean {
  const startOfTodayUtc = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  return dueDate.getTime() < startOfTodayUtc - DAY_MS;
}
