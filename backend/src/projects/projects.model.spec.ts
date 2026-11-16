import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { ProjectStatus } from '../generated/prisma/client.js';
import { ProjectStatusGql } from './projects.model.js';

describe('ProjectStatusGql (RF-003)', () => {
  it('incluye Draft para serializar proyectos en borrador', () => {
    expect(ProjectStatusGql.Draft).toBe('Draft');
  });

  it('coincide con los estados del enum ProjectStatus de Prisma', () => {
    expect(new Set(Object.values(ProjectStatusGql))).toEqual(
      new Set(Object.values(ProjectStatus)),
    );
  });
});
