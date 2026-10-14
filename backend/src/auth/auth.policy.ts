import {
  ACCOUNT_LOCKOUT_MINUTES,
  AUTHORIZED_EMAIL_DOMAINS_ENV_VAR,
  INSTITUTIONAL_EMAIL_DOMAIN,
  MAX_FAILED_LOGIN_ATTEMPTS,
} from './auth.constants.js';

/** Estado minimo de bloqueo leido desde la fila del usuario. */
export interface LockoutState {
  failedAttempts: number;
  lockedUntil: Date | string | null | undefined;
}

/** Resultado de evaluar si la cuenta esta bloqueada en un instante dado. */
export interface LockoutEvaluation {
  locked: boolean;
  /** Instante en que expira el bloqueo (solo si locked === true). */
  lockedUntil: Date | null;
}

/**
 * Validacion del dominio institucional (BR-005, scope UNIPOLI Durango).
 * Insensible a mayusculas/minusculas y a espacios accidentales.
 */
export function isInstitutionalEmail(email: unknown): boolean {
  if (typeof email !== 'string') {
    return false;
  }
  return email.trim().toLowerCase().endsWith(INSTITUTIONAL_EMAIL_DOMAIN);
}

/**
 * Normaliza la lista cruda de dominios autorizados (RF-015) a un arreglo de
 * sufijos `@dominio` en minusculas, sin duplicados. Acepta entradas con o
 * sin `@`, con espacios y en cualquier caso. Siempre incluye el dominio
 * institucional aunque no venga en la lista.
 */
export function parseAuthorizedDomains(raw: unknown): string[] {
  const domains = new Set<string>();
  if (typeof raw === 'string') {
    for (const part of raw.split(',')) {
      const cleaned = part.trim().toLowerCase().replace(/^@+/, '');
      if (cleaned) {
        domains.add(`@${cleaned}`);
      }
    }
  }
  domains.add(INSTITUTIONAL_EMAIL_DOMAIN);
  return [...domains];
}

/** Lee la lista de dominios autorizados desde el entorno (RF-015). */
export function getAuthorizedEmailDomains(): string[] {
  return parseAuthorizedDomains(
    process.env[AUTHORIZED_EMAIL_DOMAINS_ENV_VAR],
  );
}

/**
 * Validacion de dominio autorizado (BR-005 + RF-015): institucional o uno de
 * los dominios externos previamente autorizados. Se aplica al registro por
 * formulario y por OAuth (donde el hook de `/sign-up/email` no llega).
 */
export function isAuthorizedEmail(
  email: unknown,
  domains: string[] = getAuthorizedEmailDomains(),
): boolean {
  if (typeof email !== 'string') {
    return false;
  }
  const normalized = email.trim().toLowerCase();
  return domains.some((domain) => normalized.endsWith(domain));
}

/** Mensaje en espanol para rechazos por dominio (se genera desde la lista). */
export function unauthorizedDomainMessage(domains: string[]): string {
  const names = domains.map((domain) => domain.replace(/^@+/, '')).join(', ');
  return `Solo se aceptan correos de dominios autorizados: ${names}`;
}

/**
 * Determina si la cuenta esta bloqueada en el instante `now`.
 * El bloqueo expira solo: un `lockedUntil` pasado no bloquea.
 */
export function evaluateLockout(state: LockoutState, now: Date): LockoutEvaluation {
  const lockedUntil = toDateOrNull(state.lockedUntil);
  if (lockedUntil && lockedUntil.getTime() > now.getTime()) {
    return { locked: true, lockedUntil };
  }
  return { locked: false, lockedUntil: null };
}

/** Estado a persistir despues de un intento fallido de login. */
export interface FailureUpdate {
  failedAttempts: number;
  lockedUntil: Date | null;
}

/**
 * Calcula el nuevo estado tras un intento FALLIDO.
 * Al alcanzar MAX_FAILED_LOGIN_ATTEMPTS fija lockedUntil = now + 15 min.
 */
export function nextStateAfterFailure(
  state: Pick<LockoutState, 'failedAttempts'>,
  now: Date,
): FailureUpdate {
  const failedAttempts = (state.failedAttempts ?? 0) + 1;
  if (failedAttempts >= MAX_FAILED_LOGIN_ATTEMPTS) {
    return {
      failedAttempts,
      lockedUntil: new Date(
        now.getTime() + ACCOUNT_LOCKOUT_MINUTES * 60 * 1000,
      ),
    };
  }
  return { failedAttempts, lockedUntil: null };
}

/** Estado a persistir despues de un login EXITOSO (resetea el contador). */
export function nextStateAfterSuccess(): FailureUpdate {
  return { failedAttempts: 0, lockedUntil: null };
}

function toDateOrNull(value: Date | string | null | undefined): Date | null {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
