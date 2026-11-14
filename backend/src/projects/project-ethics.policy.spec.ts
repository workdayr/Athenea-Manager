import { describe, expect, it } from 'vitest';
import {
  computeRetentionDeleteAt,
  isEthicsApprovalValid,
  isRetentionDeletionDue,
  isRetentionNoticeDue,
  requiresAnonymizationCertification,
  requiresEthicsApproval,
} from './project-ethics.policy.js';

const noFlags = {
  research_involves_humans: false,
  research_involves_animals: false,
  uses_sensitive_data: false,
};

describe('project-ethics.policy (F1-11 / BR-006, BR-012, BR-013)', () => {
  it('exige aprobacion de etica con humanos, animales o datos sensibles', () => {
    expect(requiresEthicsApproval(noFlags)).toBe(false);
    expect(
      requiresEthicsApproval({ ...noFlags, research_involves_humans: true }),
    ).toBe(true);
    expect(
      requiresEthicsApproval({ ...noFlags, research_involves_animals: true }),
    ).toBe(true);
    expect(
      requiresEthicsApproval({ ...noFlags, uses_sensitive_data: true }),
    ).toBe(true);
  });

  it('solo acepta un IRB aprobado por la administracion', () => {
    expect(
      isEthicsApprovalValid({
        doc_type: 'ethics_approval',
        review_status: 'Approved',
      }),
    ).toBe(true);
    expect(
      isEthicsApprovalValid({
        doc_type: 'ethics_approval',
        review_status: 'Pending',
      }),
    ).toBe(false);
    expect(
      isEthicsApprovalValid({ doc_type: 'results', review_status: 'Approved' }),
    ).toBe(false);
  });

  it('BR-012: exige certificacion para XLSX de proyectos con humanos', () => {
    const project = {
      ...noFlags,
      research_involves_humans: true,
      anonymization_certified: false,
    };
    expect(requiresAnonymizationCertification(project, 'xlsx')).toBe(true);
    expect(
      requiresAnonymizationCertification(
        { ...project, anonymization_certified: true },
        'xlsx',
      ),
    ).toBe(false);
    expect(requiresAnonymizationCertification(project, 'pdf')).toBe(false);
    expect(
      requiresAnonymizationCertification(
        { ...project, research_involves_humans: false },
        'xlsx',
      ),
    ).toBe(false);
  });

  it('BR-013: calcula el borrado a 5 anos de la completion', () => {
    const completed = new Date('2026-03-15T10:00:00Z');
    expect(computeRetentionDeleteAt(completed, 5).toISOString()).toBe(
      '2031-03-15T10:00:00.000Z',
    );
  });

  it('BR-013: avisa dentro de los 30 dias previos y borra al vencer', () => {
    const now = new Date('2026-11-13T00:00:00Z');
    const inTwentyDays = new Date('2026-12-03T00:00:00Z');
    const inSixtyDays = new Date('2027-01-12T00:00:00Z');
    const yesterday = new Date('2026-11-12T00:00:00Z');
    expect(isRetentionNoticeDue(inTwentyDays, now, 30)).toBe(true);
    expect(isRetentionNoticeDue(inSixtyDays, now, 30)).toBe(false);
    expect(isRetentionNoticeDue(null, now, 30)).toBe(false);
    expect(isRetentionDeletionDue(yesterday, now)).toBe(true);
    expect(isRetentionDeletionDue(inTwentyDays, now)).toBe(false);
    expect(isRetentionDeletionDue(null, now)).toBe(false);
  });
});
