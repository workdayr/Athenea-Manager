import { describe, expect, it } from 'vitest';
import { ROLES } from '../auth/roles.constants.js';
import {
  canViewConfidentialProject,
  confidentialProjectFilter,
} from './project-visibility.policy.js';

const coordinator = { id: 'u-coord', role: ROLES.COORDINATOR };
const administrator = { id: 'u-admin', role: ROLES.ADMINISTRATOR };
const pi = { id: 'u-pi', role: ROLES.PRINCIPAL_INVESTIGATOR };

describe('project-visibility.policy (BR-007)', () => {
  it('solo el equipo y los administradores ven un proyecto confidencial', () => {
    expect(canViewConfidentialProject(administrator, false)).toBe(true);
    expect(canViewConfidentialProject(pi, true)).toBe(true);
    expect(canViewConfidentialProject(coordinator, false)).toBe(false);
    expect(canViewConfidentialProject(pi, false)).toBe(false);
  });

  it('no filtra nada para el administrador general', () => {
    expect(confidentialProjectFilter(administrator)).toBeNull();
  });

  it('filtra confidenciales ajenos en los listados institucionales', () => {
    expect(confidentialProjectFilter(coordinator)).toEqual({
      OR: [
        { is_confidential: false },
        { projectUsers: { some: { user_id: coordinator.id } } },
      ],
    });
  });
});
