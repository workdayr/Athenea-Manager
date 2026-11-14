import { describe, expect, it } from 'vitest';
import {
  MILESTONE_DELAY_DAYS_DEFAULT,
  daysOverdue,
  dueNoticeThreshold,
  resolveMilestoneDelayDays,
  resolveMilestoneScanIntervalMs,
  validateMilestoneName,
} from './milestones.constants.js';

describe('milestones.constants (F2-07 / BR-008)', () => {
  it('usa 7 dias de retraso por defecto y acepta override valido', () => {
    expect(MILESTONE_DELAY_DAYS_DEFAULT).toBe(7);
    expect(resolveMilestoneDelayDays({})).toBe(7);
    expect(resolveMilestoneDelayDays({ MILESTONE_DELAY_DAYS: '14' })).toBe(14);
    expect(resolveMilestoneDelayDays({ MILESTONE_DELAY_DAYS: '0' })).toBe(7);
  });

  it('valida el nombre obligatorio y su longitud maxima', () => {
    expect(validateMilestoneName('  Entrega final  ')).toBe('Entrega final');
    expect(() => validateMilestoneName('   ')).toThrow(/obligatorio/);
    expect(() => validateMilestoneName('a'.repeat(151))).toThrow(/150/);
  });

  it('selecciona el aviso de 30, 15 o 5 dias segun la fecha compromiso', () => {
    const now = new Date('2026-11-13T12:00:00Z');
    expect(dueNoticeThreshold(new Date('2026-12-13'), now)).toBe(30);
    expect(dueNoticeThreshold(new Date('2026-11-28'), now)).toBe(15);
    expect(dueNoticeThreshold(new Date('2026-11-18'), now)).toBe(5);
    expect(dueNoticeThreshold(new Date('2026-11-13'), now)).toBe(5);
    expect(dueNoticeThreshold(new Date('2026-11-12'), now)).toBe(0);
    expect(dueNoticeThreshold(new Date('2027-02-01'), now)).toBe(0);
  });

  it('calcula dias vencidos sin negativos', () => {
    const now = new Date('2026-11-20T08:00:00');
    expect(daysOverdue(new Date('2026-11-18'), now)).toBe(2);
    expect(daysOverdue(new Date('2026-11-20'), now)).toBe(0);
    expect(daysOverdue(new Date('2026-11-25'), now)).toBe(0);
  });

  it('normaliza el intervalo del job y cae al default si es invalido', () => {
    expect(resolveMilestoneScanIntervalMs({})).toBe(86_400_000);
    expect(
      resolveMilestoneScanIntervalMs({ MILESTONE_SCAN_INTERVAL_MS: '60000' }),
    ).toBe(60_000);
    expect(
      resolveMilestoneScanIntervalMs({ MILESTONE_SCAN_INTERVAL_MS: '-1' }),
    ).toBe(86_400_000);
  });
});
