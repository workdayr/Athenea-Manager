import { describe, expect, it } from 'vitest';
import { ROLES } from '../auth/roles.constants.js';
import {
  canRoleTransition,
  isProjectStatus,
  isReviewSlaOverdue,
  isTransitionAllowed,
  requiresJustification,
  validateJustification,
} from './project-lifecycle.policy.js';

describe('project-lifecycle.policy (F1-02 / RF-003)', () => {
  it('permite Draft -> Proposed solo al Investigador Principal', () => {
    expect(isTransitionAllowed('Draft', 'Proposed')).toBe(true);
    expect(canRoleTransition(ROLES.PRINCIPAL_INVESTIGATOR, 'Draft', 'Proposed')).toBe(true);
    expect(canRoleTransition(ROLES.ADMINISTRATOR, 'Draft', 'Proposed')).toBe(false);
  });

  it('solo el PI completa un proyecto activo', () => {
    expect(canRoleTransition(ROLES.PRINCIPAL_INVESTIGATOR, 'Active', 'Completed')).toBe(true);
    expect(canRoleTransition(ROLES.COORDINATOR, 'Active', 'Completed')).toBe(false);
  });

  it('la coordinacion y la administracion activan un proyecto aprobado', () => {
    expect(canRoleTransition(ROLES.COORDINATOR, 'Approved', 'Active')).toBe(true);
    expect(canRoleTransition(ROLES.ADMINISTRATOR, 'Approved', 'Active')).toBe(true);
    expect(canRoleTransition(ROLES.PRINCIPAL_INVESTIGATOR, 'Approved', 'Active')).toBe(false);
  });

  it('rechaza transiciones fuera de la matriz', () => {
    expect(isTransitionAllowed('Draft', 'Approved')).toBe(false);
    expect(isTransitionAllowed('Rejected', 'Active')).toBe(false);
    expect(isTransitionAllowed('Completed', 'Active')).toBe(false);
  });

  it('exige justificacion al suspender un proyecto', () => {
    expect(requiresJustification('Active', 'Suspended')).toBe(true);
    expect(requiresJustification('Suspended', 'Active')).toBe(false);
    expect(validateJustification('   ', true)).not.toBeNull();
    expect(validateJustification('Suspension por falta de presupuesto', true)).toBeNull();
  });

  it('reconoce los estados del enum ProjectStatus', () => {
    expect(isProjectStatus('Under_Review')).toBe(true);
    expect(isProjectStatus('Modification_Requested')).toBe(false);
  });

  it('marca el SLA solo para Under_Review vencido', () => {
    const now = new Date('2026-11-13T00:00:00Z');
    const old = new Date('2026-10-01T00:00:00Z');
    const recent = new Date('2026-11-10T00:00:00Z');
    expect(isReviewSlaOverdue('Under_Review', old, now, 30)).toBe(true);
    expect(isReviewSlaOverdue('Under_Review', recent, now, 30)).toBe(false);
    expect(isReviewSlaOverdue('Approved', old, now, 30)).toBe(false);
  });
});
