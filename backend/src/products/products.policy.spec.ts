import { describe, expect, it } from 'vitest';
import {
  isProjectEligibleForProduct,
  isSupportedProductType,
  isValidUrlOrDoi,
  validateRegisterProductInput,
} from './products.policy.js';

describe('ProductsPolicy (RF-007 / BR-009)', () => {
  describe('isValidUrlOrDoi', () => {
    it('acepta URLs http y https validas', () => {
      expect(isValidUrlOrDoi('https://example.com/paper.pdf')).toBe(true);
      expect(isValidUrlOrDoi('http://doi.org/10.1234/5678')).toBe(true);
      expect(isValidUrlOrDoi('https://github.com/org/repo')).toBe(true);
    });

    it('acepta formatos DOI estandar (10.xxxx/...)', () => {
      expect(isValidUrlOrDoi('10.1000/182')).toBe(true);
      expect(isValidUrlOrDoi('10.1038/nature12373')).toBe(true);
      expect(isValidUrlOrDoi('10.1145/3318464.3389700')).toBe(true);
    });

    it('rechaza strings invalidos o vacios', () => {
      expect(isValidUrlOrDoi('')).toBe(false);
      expect(isValidUrlOrDoi('not-a-url')).toBe(false);
      expect(isValidUrlOrDoi('ftp://server/file')).toBe(false);
    });
  });

  describe('isSupportedProductType', () => {
    it('acepta los 5 tipos requeridos', () => {
      expect(isSupportedProductType('journal_article')).toBe(true);
      expect(isSupportedProductType('conference_presentation')).toBe(true);
      expect(isSupportedProductType('software')).toBe(true);
      expect(isSupportedProductType('patent')).toBe(true);
      expect(isSupportedProductType('thesis')).toBe(true);
    });

    it('rechaza tipos no soportados', () => {
      expect(isSupportedProductType('book')).toBe(false);
      expect(isSupportedProductType('other')).toBe(false);
    });
  });

  describe('isProjectEligibleForProduct', () => {
    it('solo permite Active y Completed', () => {
      expect(isProjectEligibleForProduct('Active')).toBe(true);
      expect(isProjectEligibleForProduct('Completed')).toBe(true);
      expect(isProjectEligibleForProduct('Draft')).toBe(false);
      expect(isProjectEligibleForProduct('Proposed')).toBe(false);
      expect(isProjectEligibleForProduct('Under_Review')).toBe(false);
      expect(isProjectEligibleForProduct('Closed')).toBe(false);
    });
  });

  describe('validateRegisterProductInput', () => {
    it('valida exitosamente una entrada correcta', () => {
      const issues = validateRegisterProductInput({
        productType: 'journal_article',
        urlDoi: '10.1000/182',
        title: 'Articulo cientifico',
        authors: ['user-1', 'user-2'],
      });
      expect(issues).toHaveLength(0);
    });

    it('reporta error si falta autor o url/doi es invalido', () => {
      const issues = validateRegisterProductInput({
        productType: 'unknown_type',
        urlDoi: 'invalido',
        authors: [],
      });
      expect(issues.some((i) => i.field === 'productType')).toBe(true);
      expect(issues.some((i) => i.field === 'urlDoi')).toBe(true);
      expect(issues.some((i) => i.field === 'authors')).toBe(true);
    });
  });
});
