import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../db/prisma.js', () => ({
  prisma: {
    project: { findUnique: vi.fn() },
    project_User: { findFirst: vi.fn() },
    projectDocument: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    audit_Log: { create: vi.fn() },
  },
}));

import { prisma } from '../db/prisma.js';
import {
  DOCUMENT_VISIBILITY_ERROR_CODES,
} from './documents.constants.js';
import {
  listProjectDocuments,
  setDocumentVisibility,
} from './documents.service.js';

const piUser = {
  id: 'u-pi-1',
  email: 'pi@unipolidgo.edu.mx',
  name: 'Investigador Principal',
  role: 'PRINCIPAL_INVESTIGATOR',
} as const;

const adminUser = {
  id: 'u-admin-1',
  email: 'admin@unipolidgo.edu.mx',
  name: 'Administrador',
  role: 'ADMINISTRATOR',
} as const;

const projectRow = {
  project_id: 10,
  title: 'Proyecto de prueba',
  status: 'Active',
} as unknown;

const evidenceDocument = {
  document_id: 55,
  project_id: 10,
  doc_type: 'evidence',
  visibility: 'Team_only',
  file_url: '/uploads/projects/10/evidencia.pdf',
  version: 1,
  file_name: 'evidencia.pdf',
  file_size: 1024,
  uploaded_at: new Date('2026-10-01T10:00:00Z'),
};

const methodologyDocument = {
  ...evidenceDocument,
  document_id: 56,
  doc_type: 'methodology',
  visibility: 'Shared_with_administration',
  file_name: 'protocolo.pdf',
};

beforeEach(() => {
  vi.resetAllMocks();
  (prisma.project.findUnique as any).mockResolvedValue(projectRow);
  (prisma.project_User.findFirst as any).mockResolvedValue({
    projectuser_id: 1,
    project_id: 10,
    user_id: piUser.id,
    project_role: 'Principal_Investigator',
  });
  (prisma.projectDocument.findFirst as any).mockResolvedValue(evidenceDocument);
  (prisma.projectDocument.update as any).mockImplementation(
    ({ data }: { data: { visibility: string } }) =>
      Promise.resolve({ ...evidenceDocument, visibility: data.visibility }),
  );
  (prisma.audit_Log.create as any).mockResolvedValue({});
});

describe('setDocumentVisibility (US 4.1 / RF-005)', () => {
  it('permite al PI compartir un documento opcional y audita el cambio', async () => {
    const result = await setDocumentVisibility(
      piUser,
      10,
      55,
      'Shared_with_administration',
      '10.0.0.5',
    );

    expect(result.visibility).toBe('Shared_with_administration');
    expect(result.mandatory_review).toBe(false);
    expect(prisma.projectDocument.update).toHaveBeenCalledWith({
      where: { document_id: 55 },
      data: { visibility: 'Shared_with_administration' },
    });
    expect(prisma.audit_Log.create).toHaveBeenCalledWith({
      data: {
        actor_id: piUser.id,
        action: 'set_document_visibility:evidence:Shared_with_administration',
        target_id: '55',
        source_ip: '10.0.0.5',
      },
    });
  });

  it('rechaza marcar el protocolo como Team_only', async () => {
    (prisma.projectDocument.findFirst as any).mockResolvedValue(
      methodologyDocument,
    );

    await expect(
      setDocumentVisibility(piUser, 10, 56, 'Team_only', '10.0.0.5'),
    ).rejects.toMatchObject({
      code: DOCUMENT_VISIBILITY_ERROR_CODES.MANDATORY_DOCUMENT_VISIBILITY,
      httpStatus: 409,
    });
    expect(prisma.projectDocument.update).not.toHaveBeenCalled();
  });

  it('rechaza cambios cuando el proyecto esta archivado (RF-020)', async () => {
    (prisma.project.findUnique as any).mockResolvedValue({
      ...projectRow,
      is_read_only: true,
    });

    await expect(
      setDocumentVisibility(
        piUser,
        10,
        55,
        'Shared_with_administration',
        '10.0.0.5',
      ),
    ).rejects.toMatchObject({
      code: DOCUMENT_VISIBILITY_ERROR_CODES.PROJECT_READ_ONLY,
      httpStatus: 409,
    });
    expect(prisma.projectDocument.update).not.toHaveBeenCalled();
  });

  it('rechaza cambios cuando el proyecto esta rechazado', async () => {
    (prisma.project.findUnique as any).mockResolvedValue({
      ...projectRow,
      status: 'Rejected',
    });

    await expect(
      setDocumentVisibility(
        piUser,
        10,
        55,
        'Shared_with_administration',
        '10.0.0.5',
      ),
    ).rejects.toMatchObject({
      code: DOCUMENT_VISIBILITY_ERROR_CODES.PROJECT_STATE_IMMUTABLE,
      httpStatus: 409,
    });
    expect(prisma.projectDocument.update).not.toHaveBeenCalled();
  });

  it('rechaza a un miembro del equipo que no es PI', async () => {
    (prisma.project_User.findFirst as any).mockResolvedValue(null);

    await expect(
      setDocumentVisibility(piUser, 10, 55, 'Shared_with_administration', 'x'),
    ).rejects.toMatchObject({ code: 'FORBIDDEN', httpStatus: 403 });
  });

  it('no actualiza un documento que pertenece a otro proyecto', async () => {
    (prisma.projectDocument.findFirst as any).mockResolvedValue(null);

    await expect(
      setDocumentVisibility(piUser, 10, 999, 'Team_only', 'x'),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', httpStatus: 404 });
  });

  it('es idempotente: no reescribe ni audita si la visibilidad no cambia', async () => {
    const result = await setDocumentVisibility(
      piUser,
      10,
      55,
      'Team_only',
      'x',
    );

    expect(result.visibility).toBe('Team_only');
    expect(prisma.projectDocument.update).not.toHaveBeenCalled();
    expect(prisma.audit_Log.create).not.toHaveBeenCalled();
  });

  it('nunca expone file_url en la respuesta', async () => {
    const result = await setDocumentVisibility(
      piUser,
      10,
      55,
      'Shared_with_administration',
      'x',
    );
    expect(result).not.toHaveProperty('file_url');
  });
});

describe('listProjectDocuments (US 4.1 / RF-005)', () => {
  it('el equipo ve todos los documentos del proyecto', async () => {
    (prisma.projectDocument.findMany as any).mockResolvedValue([
      methodologyDocument,
      evidenceDocument,
    ]);

    const result = await listProjectDocuments(piUser, 10);

    expect(result).toHaveLength(2);
    expect(prisma.projectDocument.findMany).toHaveBeenCalledWith({
      where: { project_id: 10 },
      orderBy: { uploaded_at: 'desc' },
    });
    expect(result[0]?.can_change_visibility).toBe(false); // obligatorio
    expect(result[1]?.can_change_visibility).toBe(true); // evidencia
  });

  it('la administracion solo recibe documentos compartidos', async () => {
    (prisma.project_User.findFirst as any).mockResolvedValue(null);
    (prisma.projectDocument.findMany as any).mockResolvedValue([
      methodologyDocument,
    ]);

    const result = await listProjectDocuments(adminUser, 10);

    expect(prisma.projectDocument.findMany).toHaveBeenCalledWith({
      where: { project_id: 10, visibility: 'Shared_with_administration' },
      orderBy: { uploaded_at: 'desc' },
    });
    expect(result[0]?.can_change_visibility).toBe(false);
    expect(result[0]).not.toHaveProperty('file_url');
  });

  it('rechaza a usuarios ajenos sin rol institucional', async () => {
    (prisma.project_User.findFirst as any).mockResolvedValue(null);

    await expect(
      listProjectDocuments(
        { ...piUser, id: 'u-outsider', role: 'STUDENT' },
        10,
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN', httpStatus: 403 });
  });

  it('devuelve NOT_FOUND si el proyecto no existe', async () => {
    (prisma.project.findUnique as any).mockResolvedValue(null);

    await expect(listProjectDocuments(piUser, 404)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      httpStatus: 404,
    });
  });
});
