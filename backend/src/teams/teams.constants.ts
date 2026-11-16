/** F2-02 / RF-011 / BR-010: equipos e invitaciones. */

export const TEAM_ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  ALREADY_MEMBER: 'ALREADY_MEMBER',
  INVITATION_EXPIRED: 'INVITATION_EXPIRED',
  INVITATION_REVOKED: 'INVITATION_REVOKED',
  AFFIDAVIT_REQUIRED: 'AFFIDAVIT_REQUIRED',
  PI_ROLE_IMMUTABLE: 'PI_ROLE_IMMUTABLE',
  PROJECT_ARCHIVED: 'PROJECT_ARCHIVED',
} as const;

export const INVITATION_TTL_DAYS = 7;
export const INVITATION_EMAIL_MAX_LENGTH = 320;

/** Roles de proyecto asignables por invitacion (el PI se fija al alta). */
export const INVITABLE_PROJECT_ROLES = [
  'Co_Investigator',
  'Assistant',
] as const;

export type InvitableProjectRole = (typeof INVITABLE_PROJECT_ROLES)[number];

export function isInvitableProjectRole(
  value: string,
): value is InvitableProjectRole {
  return (INVITABLE_PROJECT_ROLES as readonly string[]).includes(value);
}

export function invitationExpiresAt(now: Date = new Date()): Date {
  return new Date(now.getTime() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export function isInvitationExpired(
  expiresAt: Date,
  now: Date = new Date(),
): boolean {
  return expiresAt.getTime() <= now.getTime();
}

/** Validacion de correo: suficiente para invitaciones institucionales. */
export function isValidInvitationEmail(email: string): boolean {
  if (!email || email.length > INVITATION_EMAIL_MAX_LENGTH) {
    return false;
  }
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function normalizeInvitationEmail(email: string): string {
  return email.trim().toLowerCase();
}
