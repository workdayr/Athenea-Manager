import { describe, expect, it } from 'vitest';
import { PROJECT_ERROR_CODES } from './projects.constants.js';
import {
  assertProjectWritable,
  isProjectReadOnly,
  PROJECT_READ_ONLY_MESSAGE,
  ProjectReadOnlyError,
} from './project-write-guard.js';

describe('project-write-guard (RF-020)', () => {
  it('detecta un proyecto archivado', () => {
    expect(isProjectReadOnly({ is_read_only: true })).toBe(true);
  });

  it('no marca como archivado un proyecto activo o sin el campo', () => {
    expect(isProjectReadOnly({ is_read_only: false })).toBe(false);
    expect(isProjectReadOnly({})).toBe(false);
    expect(isProjectReadOnly(null)).toBe(false);
    expect(isProjectReadOnly(undefined)).toBe(false);
  });

  it('permite escribir cuando el proyecto no esta archivado', () => {
    expect(() => assertProjectWritable({ is_read_only: false })).not.toThrow();
    expect(() => assertProjectWritable({})).not.toThrow();
  });

  it('bloquea escrituras con PROJECT_READ_ONLY (409)', () => {
    try {
      assertProjectWritable({ is_read_only: true });
      throw new Error('No se lanzo la guarda de solo lectura.');
    } catch (error) {
      expect(error).toBeInstanceOf(ProjectReadOnlyError);
      expect(error).toMatchObject({
        code: PROJECT_ERROR_CODES.PROJECT_READ_ONLY,
        httpStatus: 409,
        message: PROJECT_READ_ONLY_MESSAGE,
      });
    }
  });
});
