import { describe, expect, it } from 'vitest';
import {
  INVITATION_TTL_DAYS,
  invitationExpiresAt,
  isInvitableProjectRole,
  isInvitationExpired,
  isValidInvitationEmail,
  normalizeInvitationEmail,
} from './teams.constants.js';

describe('invitation helpers', () => {
  it('normaliza el correo a minusculas y sin espacios', () => {
    expect(normalizeInvitationEmail('  Investigador@UNIPOLI.edu.mx ')).toBe(
      'investigador@unipoli.edu.mx',
    );
  });

  it('acepta correos institucionales validos', () => {
    expect(isValidInvitationEmail('docente@unipoli.edu.mx')).toBe(true);
    expect(isValidInvitationEmail('sin-arroba')).toBe(false);
    expect(isValidInvitationEmail('a@b')).toBe(false);
    expect(isValidInvitationEmail('a'.repeat(320) + '@b.mx')).toBe(false);
  });

  it('solo permite roles no PI', () => {
    expect(isInvitableProjectRole('Co_Investigator')).toBe(true);
    expect(isInvitableProjectRole('Assistant')).toBe(true);
    expect(isInvitableProjectRole('Principal_Investigator')).toBe(false);
  });

  it('calcula una vigencia de 7 dias', () => {
    const now = new Date('2026-11-16T00:00:00.000Z');
    expect(invitationExpiresAt(now).toISOString()).toBe(
      '2026-11-23T00:00:00.000Z',
    );
    expect(INVITATION_TTL_DAYS).toBe(7);
  });

  it('detecta invitaciones vencidas', () => {
    const now = new Date('2026-11-16T12:00:00.000Z');
    expect(isInvitationExpired(new Date('2026-11-16T11:59:59.000Z'), now)).toBe(
      true,
    );
    expect(isInvitationExpired(new Date('2026-11-16T12:00:01.000Z'), now)).toBe(
      false,
    );
  });
});
