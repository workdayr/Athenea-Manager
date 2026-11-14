import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DOCUMENT_ERROR_CODES } from './document-upload.constants.js';
import { antivirus } from './antivirus.service.js';
import {
  uploadEvidenceDocument,
  type UploadedFile,
} from './document-upload.service.js';

vi.mock('../db/prisma.js', () => ({
  prisma: {
    $transaction: vi.fn(),
    project_User: { findFirst: vi.fn() },
    project: { findUnique: vi.fn() },
    projectDocument: {
      aggregate: vi.fn(),
      create: vi.fn(),
    },
    audit_Log: { create: vi.fn() },
  },
}));

vi.mock('./antivirus.service.js', () => ({
  antivirus: { scan: vi.fn() },
}));

import { prisma } from '../db/prisma.js';

const user = {
  id: 'u-team-1',
  email: 'member@unipolidgo.edu.mx',
  name: 'Miembro Equipo',
  role: 'STUDENT',
} as const;

const validFile: UploadedFile = {
  buffer: Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d]),
  originalname: 'evidencia.pdf',
  size: 100,
};

const projectRow = {
  project_id: 1,
  title: 'Proyecto equipo',
  status: 'Proposed',
} as unknown;

beforeEach(() => {
  vi.resetAllMocks();
  (prisma.$transaction as any).mockImplementation(
    async (fn: (tx: typeof prisma) => unknown) => fn(prisma),
  );
  (prisma.project_User.findFirst as any).mockResolvedValue({
    projectuser_id: 1,
    project_id: 1,
    user_id: 'u-team-1',
    project_role: 'Assistant',
  });
  (prisma.project.findUnique as any).mockResolvedValue(projectRow);
  (prisma.projectDocument.aggregate as any).mockResolvedValue({
    _sum: { file_size: 0 },
  });
  (prisma.projectDocument.create as any).mockResolvedValue({
    document_id: 7,
    project_id: 1,
    doc_type: 'evidence',
    visibility: 'Team_only',
    file_url: '/uploads/projects/1/pdf_evidence_1.pdf',
    version: 1,
    file_name: 'evidencia.pdf',
    file_size: 100,
    uploaded_at: new Date(),
  });
  (prisma.audit_Log.create as any).mockResolvedValue({});
  (antivirus.scan as any).mockResolvedValue('ok');
});

describe('uploadEvidenceDocument (RF-016, RNF-005)', () => {
  it('sube evidencia de un miembro del equipo (no solo PI)', async () => {
    const result = await uploadEvidenceDocument(user, 1, validFile, '10.0.0.1');
    expect(result.document_id).toBe(7);
    expect(result.doc_type).toBe('evidence');
    expect(result.visibility).toBe('Team_only');
    expect(prisma.project_User.findFirst).toHaveBeenCalledWith({
      where: { project_id: 1, user_id: 'u-team-1' },
    });
  });

  it('rechaza a quien no pertenece al equipo', async () => {
    (prisma.project_User.findFirst as any).mockResolvedValue(null);
    await expect(
      uploadEvidenceDocument(user, 1, validFile, '10.0.0.1'),
    ).rejects.toMatchObject({
      code: DOCUMENT_ERROR_CODES.FORBIDDEN,
      httpStatus: 403,
    });
    expect(prisma.projectDocument.create).not.toHaveBeenCalled();
  });

  it('rechaza proyecto inexistente', async () => {
    (prisma.project.findUnique as any).mockResolvedValue(null);
    await expect(
      uploadEvidenceDocument(user, 999, validFile, '10.0.0.1'),
    ).rejects.toMatchObject({
      code: DOCUMENT_ERROR_CODES.NOT_FOUND,
      httpStatus: 404,
    });
  });

  it('rechaza proyecto cerrado', async () => {
    (prisma.project.findUnique as any).mockResolvedValue({
      ...projectRow,
      status: 'Closed',
    });
    await expect(
      uploadEvidenceDocument(user, 1, validFile, '10.0.0.1'),
    ).rejects.toMatchObject({
      code: DOCUMENT_ERROR_CODES.CONFLICT,
      httpStatus: 409,
    });
  });

  it('rechaza evidencia en Draft: aun no esta abierto', async () => {
    (prisma.project.findUnique as any).mockResolvedValue({
      ...projectRow,
      status: 'Draft',
    });
    await expect(
      uploadEvidenceDocument(user, 1, validFile, '10.0.0.1'),
    ).rejects.toMatchObject({
      code: DOCUMENT_ERROR_CODES.CONFLICT,
      httpStatus: 409,
    });
    expect(prisma.projectDocument.create).not.toHaveBeenCalled();
  });

  it('BR-012: rechaza XLSX de proyecto con humanos sin certificacion', async () => {
    (prisma.project.findUnique as any).mockResolvedValue({
      ...projectRow,
      status: 'Active',
      research_involves_humans: true,
      research_involves_animals: false,
      uses_sensitive_data: false,
      anonymization_certified: false,
    });
    const xlsx = {
      buffer: Buffer.from([0x50, 0x4b, 0x03, 0x04]),
      originalname: 'datos.xlsx',
      size: 100,
    };

    await expect(
      uploadEvidenceDocument(user, 1, xlsx, '10.0.0.1'),
    ).rejects.toMatchObject({
      code: DOCUMENT_ERROR_CODES.ANONYMIZATION_CERTIFICATION_REQUIRED,
      httpStatus: 409,
    });
    expect(prisma.projectDocument.create).not.toHaveBeenCalled();
  });

  it('rechaza proyecto archivado en solo lectura (RF-020)', async () => {
    (prisma.project.findUnique as any).mockResolvedValue({
      ...projectRow,
      status: 'Active',
      is_read_only: true,
    });
    await expect(
      uploadEvidenceDocument(user, 1, validFile, '10.0.0.1'),
    ).rejects.toMatchObject({
      code: DOCUMENT_ERROR_CODES.PROJECT_READ_ONLY,
      httpStatus: 409,
    });
    expect(prisma.projectDocument.create).not.toHaveBeenCalled();
  });

  it('rechaza extension no permitida', async () => {
    await expect(
      uploadEvidenceDocument(
        user,
        1,
        { ...validFile, originalname: 'script.sh' },
        '10.0.0.1',
      ),
    ).rejects.toMatchObject({
      code: DOCUMENT_ERROR_CODES.UNSUPPORTED_MEDIA_TYPE,
    });
  });

  it('rechaza extension que miente sobre el contenido', async () => {
    await expect(
      uploadEvidenceDocument(
        user,
        1,
        { ...validFile, originalname: 'imagen.png' },
        '10.0.0.1',
      ),
    ).rejects.toMatchObject({
      code: DOCUMENT_ERROR_CODES.UNSUPPORTED_MEDIA_TYPE,
    });
  });

  it('rechaza archivo mayor a 25 MB', async () => {
    await expect(
      uploadEvidenceDocument(
        user,
        1,
        { ...validFile, size: 26 * 1024 * 1024 },
        '10.0.0.1',
      ),
    ).rejects.toMatchObject({
      code: DOCUMENT_ERROR_CODES.PAYLOAD_TOO_LARGE,
      httpStatus: 413,
    });
  });

  it('rechaza archivo infectado y no guarda nada (F-05)', async () => {
    (antivirus.scan as any).mockResolvedValue('infected');
    await expect(
      uploadEvidenceDocument(user, 1, validFile, '10.0.0.1'),
    ).rejects.toMatchObject({
      code: DOCUMENT_ERROR_CODES.MALWARE_DETECTED,
      httpStatus: 422,
    });
    expect(prisma.projectDocument.create).not.toHaveBeenCalled();
    expect(prisma.audit_Log.create).not.toHaveBeenCalled();
  });

  it('rechaza cuando el antivirus no esta disponible (503, nada guardado)', async () => {
    (antivirus.scan as any).mockResolvedValue('unavailable');
    await expect(
      uploadEvidenceDocument(user, 1, validFile, '10.0.0.1'),
    ).rejects.toMatchObject({
      code: DOCUMENT_ERROR_CODES.SCAN_UNAVAILABLE,
      httpStatus: 503,
    });
    expect(prisma.projectDocument.create).not.toHaveBeenCalled();
  });

  it('excede cuota 500 MB y no guarda', async () => {
    (prisma.projectDocument.aggregate as any).mockResolvedValue({
      _sum: { file_size: 490 * 1024 * 1024 },
    });
    await expect(
      uploadEvidenceDocument(user, 1, { ...validFile, size: 20 * 1024 * 1024 }, '10.0.0.1'),
    ).rejects.toMatchObject({
      code: DOCUMENT_ERROR_CODES.PAYLOAD_TOO_LARGE,
    });
    expect(prisma.projectDocument.create).not.toHaveBeenCalled();
  });

  it('registra auditoria RF-017 al subir con exito', async () => {
    await uploadEvidenceDocument(user, 1, validFile, '10.0.0.2');
    expect(prisma.audit_Log.create).toHaveBeenCalledWith({
      data: {
        actor_id: 'u-team-1',
        action: 'upload_evidence_document:pdf',
        target_id: '1',
        source_ip: '10.0.0.2',
      },
    });
  });

  it('vincula la evidencia al hito dentro de la transaccion (RF-006)', async () => {
    await uploadEvidenceDocument(user, 1, validFile, '10.0.0.3', {
      milestoneId: 42,
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.projectDocument.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ milestone_id: 42 }),
    });
  });

  it('documento y auditoria se escriben en la misma transaccion', async () => {
    await uploadEvidenceDocument(user, 1, validFile, '10.0.0.4');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.projectDocument.create).toHaveBeenCalled();
    expect(prisma.audit_Log.create).toHaveBeenCalled();
  });
});
