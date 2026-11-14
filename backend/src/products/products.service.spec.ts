import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../db/prisma.js', () => ({
  prisma: {
    project: { findUnique: vi.fn() },
    user: { findMany: vi.fn() },
    product: { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { prisma } from '../db/prisma.js';
import {
  PRODUCT_ERROR_CODES,
} from './products.constants.js';
import {
  getProjectProducts,
  registerResearchOutput,
} from './products.service.js';

const piUser = {
  id: 'u-pi-1',
  email: 'pi@unipolidgo.edu.mx',
  name: 'Investigador Principal',
  role: 'PRINCIPAL_INVESTIGATOR',
};

const activeProject = {
  project_id: 10,
  title: 'Proyecto de Prueba',
  status: 'Active',
  is_read_only: false,
  projectUsers: [
    { user_id: 'u-pi-1', project_role: 'Principal_Investigator' },
  ],
};

beforeEach(() => {
  vi.resetAllMocks();
  (prisma.project.findUnique as any).mockResolvedValue(activeProject);
  (prisma.user.findMany as any).mockResolvedValue([
    { id: 'u-pi-1', name: 'Investigador Principal', email: 'pi@unipolidgo.edu.mx' },
  ]);
  (prisma.$transaction as any).mockImplementation(async (callback: any) => {
    const tx = {
      product: {
        create: vi.fn().mockResolvedValue({
          product_id: 101,
          project_id: 10,
          product_type: 'journal_article',
          url_doi: 'https://doi.org/10.1234/test',
          title: 'Paper Title',
          created_at: new Date('2026-11-13T20:00:00Z'),
        }),
      },
      product_Author: {
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      audit_Log: {
        create: vi.fn().mockResolvedValue({}),
      },
    };
    return callback(tx);
  });
});

describe('registerResearchOutput (RF-007 / BR-009)', () => {
  it('registra exitosamente un producto para un proyecto activo', async () => {
    const result = await registerResearchOutput(
      piUser,
      {
        projectId: 10,
        productType: 'journal_article',
        urlDoi: 'https://doi.org/10.1234/test',
        title: 'Paper Title',
        authors: ['u-pi-1'],
      },
      '192.168.1.1',
    );

    expect(result.productId).toBe(101);
    expect(result.productType).toBe('journal_article');
    expect(result.authors).toHaveLength(1);
    expect(result.authors[0]?.userId).toBe('u-pi-1');
  });

  it('rechaza el registro si el proyecto no esta en Active o Completed', async () => {
    (prisma.project.findUnique as any).mockResolvedValue({
      ...activeProject,
      status: 'Proposed',
    });

    await expect(
      registerResearchOutput(piUser, {
        projectId: 10,
        productType: 'journal_article',
        urlDoi: 'https://doi.org/10.1234/test',
        authors: ['u-pi-1'],
      }),
    ).rejects.toMatchObject({
      code: PRODUCT_ERROR_CODES.PROJECT_STATE_INVALID,
      httpStatus: 409,
    });
  });

  it('rechaza si el usuario no es el PI del proyecto', async () => {
    (prisma.project.findUnique as any).mockResolvedValue({
      ...activeProject,
      projectUsers: [],
    });

    await expect(
      registerResearchOutput(piUser, {
        projectId: 10,
        productType: 'journal_article',
        urlDoi: 'https://doi.org/10.1234/test',
        authors: ['u-pi-1'],
      }),
    ).rejects.toMatchObject({
      code: PRODUCT_ERROR_CODES.FORBIDDEN,
      httpStatus: 403,
    });
  });

  it('rechaza si el URL/DOI tiene formato invalido', async () => {
    await expect(
      registerResearchOutput(piUser, {
        projectId: 10,
        productType: 'journal_article',
        urlDoi: 'invalid-doi',
        authors: ['u-pi-1'],
      }),
    ).rejects.toMatchObject({
      code: PRODUCT_ERROR_CODES.INVALID_URL_DOI,
      httpStatus: 400,
    });
  });
});

describe('getProjectProducts', () => {
  it('retorna la lista de productos con autores ordenados', async () => {
    (prisma.product.findMany as any).mockResolvedValue([
      {
        product_id: 101,
        project_id: 10,
        product_type: 'journal_article',
        url_doi: 'https://doi.org/10.1234/test',
        title: 'Paper Title',
        created_at: new Date('2026-11-13T20:00:00Z'),
        authors: [
          {
            author_order: 1,
            user: { id: 'u-pi-1', name: 'PI Name', email: 'pi@example.com' },
          },
        ],
      },
    ]);

    const result = await getProjectProducts(10);
    expect(result).toHaveLength(1);
    expect(result[0]?.authors[0]?.authorOrder).toBe(1);
  });
});
