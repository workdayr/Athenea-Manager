import { describe, expect, it } from 'vitest';
import {
  canCreateProposalVersion,
  validateProposalVersionInput,
} from './proposal-versions.policy.js';

describe('ProposalVersionsPolicy (RF-004)', () => {
  describe('canCreateProposalVersion', () => {
    it('permite crear versiones cuando hay menos de 5 versiones', () => {
      expect(canCreateProposalVersion(0)).toBe(true);
      expect(canCreateProposalVersion(1)).toBe(true);
      expect(canCreateProposalVersion(4)).toBe(true);
    });

    it('bloquea la creacion al alcanzar el limite de 5', () => {
      expect(canCreateProposalVersion(5)).toBe(false);
      expect(canCreateProposalVersion(6)).toBe(false);
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
});
