import { describe, expect, it } from 'vitest';
import {
  canCreateProposalVersion,
  canViewProposalVersions,
  nextProposalVersionNumber,
  remainingProposalVersions,
  validateProposalDocumentTypes,
  validateProposalVersionInput,
} from './proposal-versions.policy.js';

describe('ProposalVersionsPolicy', () => {
  describe('limite de versiones', () => {
    it('la siguiente version continua la numeracion cronologica', () => {
      expect(nextProposalVersionNumber(null)).toBe(2);
      expect(nextProposalVersionNumber(1)).toBe(2);
      expect(nextProposalVersionNumber(4)).toBe(5);
    });

    it('cuenta la propuesta inicial dentro del maximo de 5', () => {
      expect(canCreateProposalVersion(2)).toBe(true);
      expect(canCreateProposalVersion(4)).toBe(true);
      expect(canCreateProposalVersion(5)).toBe(true);
      expect(canCreateProposalVersion(6)).toBe(false);
    });

    it('reporta cuantas versiones quedan disponibles', () => {
      expect(remainingProposalVersions(null)).toBe(4);
      expect(remainingProposalVersions(2)).toBe(3);
      expect(remainingProposalVersions(5)).toBe(0);
    });
  });

  describe('validateProposalVersionInput', () => {
    it('acepta entrada valida con comentario opcional', () => {
      const issues = validateProposalVersionInput({
        projectId: 1,
        comment: 'Ajustes a la metodología',
      });
      expect(issues).toHaveLength(0);
    });

    it('rechaza comentarios excesivamente largos', () => {
      const issues = validateProposalVersionInput({
        projectId: 1,
        comment: 'a'.repeat(4001),
      });
      expect(issues).toHaveLength(1);
      expect(issues[0]?.field).toBe('comment');
    });
  });

  describe('validateProposalDocumentTypes', () => {
    it('acepta los tipos documentales de la propuesta', () => {
      expect(
        validateProposalDocumentTypes(['methodology', 'results']),
      ).toBeNull();
    });

    it('rechaza tipos fuera del catalogo', () => {
      const issue = validateProposalDocumentTypes(['methodology', 'evidence']);
      expect(issue?.field).toBe('docTypes');
      expect(issue?.message).toContain('evidence');
    });

    it('exige al menos un documento', () => {
      expect(validateProposalDocumentTypes([])?.field).toBe('docTypes');
    });
  });

  describe('canViewProposalVersions', () => {
    const committee = { id: 'c-1', role: 'COMMITTEE' };
    const admin = { id: 'a-1', role: 'ADMINISTRATOR' };
    const otherPi = { id: 'p-2', role: 'PRINCIPAL_INVESTIGATOR' };
    const teamStudent = { id: 's-1', role: 'STUDENT' };

    it('permite al equipo del proyecto, incluso en confidenciales', () => {
      expect(
        canViewProposalVersions(teamStudent, {
          isTeamMember: true,
          isConfidential: true,
        }),
      ).toBe(true);
    });

    it('permite al comite en proyectos no confidenciales', () => {
      expect(
        canViewProposalVersions(committee, {
          isTeamMember: false,
          isConfidential: false,
        }),
      ).toBe(true);
    });

    it('restringe los confidenciales al equipo y al administrador', () => {
      expect(
        canViewProposalVersions(committee, {
          isTeamMember: false,
          isConfidential: true,
        }),
      ).toBe(false);
      expect(
        canViewProposalVersions(admin, {
          isTeamMember: false,
          isConfidential: true,
        }),
      ).toBe(true);
    });

    it('niega el acceso a otro investigador ajeno al proyecto', () => {
      expect(
        canViewProposalVersions(otherPi, {
          isTeamMember: false,
          isConfidential: false,
        }),
      ).toBe(false);
    });
  });
});
