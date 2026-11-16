import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../db/prisma.js', () => ({
  prisma: {
    project: { findUnique: vi.fn() },
    projectDocument: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    audit_Log: { create: vi.fn() },
  },
}));

import { prisma } from '../db/prisma.js';
import { DOCUMENT_REVIEW_ERROR_CODES } from './document-review.constants.js';
import { reviewProjectDocument } from './document-review.service.js';

const admin = {
  id: 'u-admin',
  email: 'admin@unipolidgo.edu.mx',
  name: 'Administrador',
  role: 'ADMINISTRATOR',
} as const;

const coordinator = {
  id: 'u-coord',
  email: 'coord@unipolidgo.edu.mx',
  name: 'Coordinador',
  role: 'COORDINATOR',
} as const;

const projectRow = { project_id: 10, is_read_only: false };

const resultsDocument = {
  document_id: 70,
  project_id: 10,
  doc_type: 'results',
  visibility: 'Shared_with_administration',
  file_url: '/uploads/projects/10/results.pdf',
  version: 1,
  file_name: 'informe.pdf',
  file_size: 1024,
  uploaded_at: new Date('2026-10-01T10:00:00Z'),
  review_status: 'Pending',
  reviewed_at: null,
  review_notes: null,
};

beforeEach(() => {
  vi.resetAllMocks();
  (prisma.project.findUnique as any).mockResolvedValue(projectRow);
  (prisma.projectDocument.findFirst as any).mockResolvedValue(resultsDocument);
  (prisma.projectDocument.update as any).mockImplementation(
    ({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({
        ...resultsDocument,
        ...data,
        reviewer: { name: 'Administrador' },
      }),
  );
  (prisma.audit_Log.create as any).mockResolvedValue({});
});

describe('reviewProjectDocument (F1-11 / BR-003)', () => {
  it('aprueba el informe final, guarda trazabilidad y audita', async () => {
    const result = await reviewProjectDocument(
      admin,
      10,
      70,
      'Approved',
      'Informe completo.',
      '10.0.0.1',
    );

    expect(result.review_status).toBe('Approved');
    expect(result.reviewer_name).toBe('Administrador');
    expect(result.can_review).toBe(true);
    expect(prisma.projectDocument.update).toHaveBeenCalledWith({
      where: { document_id: 70 },
      data: {
        review_status: 'Approved',
        reviewed_at: expect.any(Date),
        reviewed_by: admin.id,
        review_notes: 'Informe completo.',
      },
      include: { reviewer: { select: { name: true } } },
    });
    expect(prisma.audit_Log.create).toHaveBeenCalledWith({
      data: {
        actor_id: admin.id,
        action: 'review_project_document:results:Approved',
        target_id: '70',
        source_ip: '10.0.0.1',
      },
    });
  });

  it('la coordinacion tambien puede rechazar', async () => {
    const result = await reviewProjectDocument(
      coordinator,
      10,
      70,
      'Rejected',
      null,
      'x',
    );
    expect(result.review_status).toBe('Rejected');
  });

  it('rechaza roles sin permiso de revision', async () => {
    await expect(
      reviewProjectDocument(
        { ...admin, role: 'COMMITTEE' },
        10,
        70,
        'Approved',
        null,
        'x',
      ),
    ).rejects.toMatchObject({
      code: DOCUMENT_REVIEW_ERROR_CODES.FORBIDDEN,
      httpStatus: 403,
    });
    expect(prisma.projectDocument.update).not.toHaveBeenCalled();
  });

  it('rechaza documentos que no requieren revision', async () => {
    (prisma.projectDocument.findFirst as any).mockResolvedValue({
      ...resultsDocument,
      doc_type: 'evidence',
    });

    await expect(
      reviewProjectDocument(admin, 10, 70, 'Approved', null, 'x'),
    ).rejects.toMatchObject({
      code: DOCUMENT_REVIEW_ERROR_CODES.NOT_REVIEWABLE,
      httpStatus: 409,
    });
  });

  it('valida la decision antes de escribir', async () => {
    await expect(
      reviewProjectDocument(admin, 10, 70, 'Pending', null, 'x'),
    ).rejects.toMatchObject({
      code: DOCUMENT_REVIEW_ERROR_CODES.VALIDATION_ERROR,
    });
    expect(prisma.projectDocument.update).not.toHaveBeenCalled();
  });
});
