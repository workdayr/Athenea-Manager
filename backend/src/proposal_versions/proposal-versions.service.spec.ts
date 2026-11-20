import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../db/prisma.js', () => ({
  prisma: {
    project: { findUnique: vi.fn() },
    projectDocument: { aggregate: vi.fn() },
    proposal_Version: { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
  unlink: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../notifications/notifications.service.js', () => ({
  notifyRole: vi.fn().mockResolvedValue({}),
}));

vi.mock('../document_upload/antivirus.service.js', () => ({
  antivirus: { scan: vi.fn().mockResolvedValue('ok') },
}));

import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { antivirus } from '../document_upload/antivirus.service.js';
import { prisma } from '../db/prisma.js';
import { PROPOSAL_VERSION_ERROR_CODES } from './proposal-versions.constants.js';
import {
  listProposalVersions,
  proposalVersionState,
  uploadRevisedProposal,
} from './proposal-versions.service.js';

const piUser = {
  id: 'u-pi-1',
  email: 'pi@unipolidgo.edu.mx',
  name: 'Investigador Principal',
  role: 'PRINCIPAL_INVESTIGATOR',
};

const committeeUser = {
  id: 'u-com-1',
  email: 'comite@unipolidgo.edu.mx',
  name: 'Comite',
  role: 'COMMITTEE',
};

const pdfBuffer = Buffer.from('%PDF-1.4 sample pdf content');

const mockProject = {
  project_id: 10,
  title: 'Proyecto con Revision Requerida',
  status: 'Under_Review',
  is_read_only: false,
  is_confidential: false,
  projectUsers: [{ project_role: 'Principal_Investigator' }],
  evaluations: [
    {
      evaluation_id: 7,
      decision: 'Revision_Required',
      justification: 'Falta profundizar en la metodologia.',
    },
  ],
  proposalVersions: [{ version_number: 1 }],
};

const accessProject = {
  project_id: 10,
  is_confidential: false,
  projectUsers: [{ project_role: 'Principal_Investigator' }],
};

function mockTransaction() {
  (prisma.$transaction as any).mockImplementation(async (callback: any) => {
    const tx = {
      proposal_Version: {
        create: vi.fn().mockImplementation(async ({ data }: any) => ({
          version_id: 2,
          project_id: data.project_id,
          version_number: data.version_number,
          submitted_by: data.submitted_by,
          status: data.status,
          submitter_comment: data.submitter_comment,
          committee_comments: data.committee_comments,
          decided_at: null,
          created_at: new Date('2026-11-13T21:00:00Z'),
          submitted_at: new Date('2026-11-13T21:00:00Z'),
        })),
      },
      projectDocument: {
        create: vi.fn().mockImplementation(async ({ data }: any) => ({
          document_id: 88,
          project_id: data.project_id,
          doc_type: data.doc_type,
          visibility: data.visibility,
          version: data.version,
          file_name: data.file_name,
          file_size: data.file_size,
          uploaded_at: new Date('2026-11-13T21:00:00Z'),
          review_status: 'Pending',
          reviewed_at: null,
          review_notes: null,
        })),
      },
      project: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      project_Status_Transition: {
        create: vi.fn().mockResolvedValue({ transition_id: 99 }),
      },
      audit_Log: {
        create: vi.fn().mockResolvedValue({}),
      },
    };
    return callback(tx);
  });
}

function validUpload(overrides: Record<string, unknown> = {}) {
  return {
    projectId: 10,
    comment: 'Se corrigio la metodologia conforme al comite.',
    files: [
      {
        docType: 'methodology',
        buffer: pdfBuffer,
        originalname: 'methodology_v2.pdf',
        size: pdfBuffer.length,
      },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  (mkdir as any).mockResolvedValue(undefined);
  (writeFile as any).mockResolvedValue(undefined);
  (unlink as any).mockResolvedValue(undefined);
  (prisma.project.findUnique as any).mockImplementation(async (args: any) =>
    args?.select ? accessProject : mockProject,
  );
  (prisma.projectDocument.aggregate as any).mockResolvedValue({
    _sum: { file_size: 1024 * 1024 },
  });
  (antivirus.scan as any).mockResolvedValue('ok');
  mockTransaction();
});

describe('uploadRevisedProposal', () => {
  it('permite al PI subir una version revisada tras Revision_Required', async () => {
    const result = await uploadRevisedProposal(
      piUser,
      validUpload() as never,
      '127.0.0.1',
    );

    expect(result.versionNumber).toBe(2);
    expect(result.status).toBe('Under_Review');
    expect(result.documents).toHaveLength(1);
    expect(result.submitterComment).toBe(
      'Se corrigio la metodologia conforme al comite.',
    );
    expect(result.committeeComments).toBe(
      'Falta profundizar en la metodologia.',
    );
  });

  it('bloquea la subida si la ultima evaluacion no es Revision_Required', async () => {
    (prisma.project.findUnique as any).mockResolvedValue({
      ...mockProject,
      evaluations: [
        {
          evaluation_id: 1,
          decision: 'Approved',
          justification: 'Aprobado sin cambios.',
        },
      ],
    });

    await expect(
      uploadRevisedProposal(piUser, validUpload() as never),
    ).rejects.toMatchObject({
      code: PROPOSAL_VERSION_ERROR_CODES.REVISION_NOT_REQUIRED,
      httpStatus: 409,
    });
  });

  it('bloquea al llegar a 5 versiones (incluida la inicial)', async () => {
    (prisma.project.findUnique as any).mockResolvedValue({
      ...mockProject,
      proposalVersions: [{ version_number: 5 }],
    });

    await expect(
      uploadRevisedProposal(piUser, validUpload() as never),
    ).rejects.toMatchObject({
      code: PROPOSAL_VERSION_ERROR_CODES.VERSION_LIMIT_REACHED,
      httpStatus: 409,
    });
  });

  it('bloquea a usuarios que no son el PI', async () => {
    (prisma.project.findUnique as any).mockResolvedValue({
      ...mockProject,
      projectUsers: [],
    });

    await expect(
      uploadRevisedProposal(piUser, validUpload() as never),
    ).rejects.toMatchObject({
      code: PROPOSAL_VERSION_ERROR_CODES.FORBIDDEN,
      httpStatus: 403,
    });
  });

  it('rechaza tipos documentales fuera del catalogo', async () => {
    const data = validUpload({
      files: [
        {
          docType: 'evidence',
          buffer: pdfBuffer,
          originalname: 'evidencia.pdf',
          size: pdfBuffer.length,
        },
      ],
    });

    await expect(
      uploadRevisedProposal(piUser, data as never),
    ).rejects.toMatchObject({
      code: PROPOSAL_VERSION_ERROR_CODES.VALIDATION_ERROR,
      httpStatus: 400,
      field: 'docTypes',
    });
    expect(writeFile).not.toHaveBeenCalled();
  });

  it('no escribe archivos cuando el antivirus detecta malware', async () => {
    (antivirus.scan as any).mockResolvedValue('infected');

    await expect(
      uploadRevisedProposal(piUser, validUpload() as never),
    ).rejects.toMatchObject({
      code: PROPOSAL_VERSION_ERROR_CODES.MALWARE_DETECTED,
      httpStatus: 422,
    });
    expect(mkdir).not.toHaveBeenCalled();
    expect(writeFile).not.toHaveBeenCalled();
  });

  it('limpia los archivos si la transaccion falla', async () => {
    (prisma.$transaction as any).mockRejectedValue(new Error('database down'));

    await expect(
      uploadRevisedProposal(piUser, validUpload() as never),
    ).rejects.toThrow('database down');
    expect(unlink).toHaveBeenCalledTimes(1);
  });
});

describe('listProposalVersions', () => {
  it('lista las versiones con el dictamen y el revisor', async () => {
    (prisma.proposal_Version.findMany as any).mockResolvedValue([
      {
        version_id: 2,
        project_id: 10,
        version_number: 2,
        submitted_by: 'u-pi-1',
        submitted_at: new Date('2026-11-13T21:00:00Z'),
        status: 'Approved',
        submitter_comment: 'Ajustes atendidos.',
        committee_comments: 'Aprobado.',
        decided_at: new Date('2026-11-14T10:00:00Z'),
        created_at: new Date('2026-11-13T21:00:00Z'),
        submitter: { name: 'PI Name' },
        reviewer: { name: 'Comite Name' },
        evaluation: { decision: 'Approved' },
        documents: [],
      },
    ]);

    const versions = await listProposalVersions(committeeUser, 10);
    expect(versions).toHaveLength(1);
    expect(versions[0]?.versionNumber).toBe(2);
    expect(versions[0]?.submitterName).toBe('PI Name');
    expect(versions[0]?.decision).toBe('Approved');
    expect(versions[0]?.reviewerName).toBe('Comite Name');
  });

  it('niega el historial a un usuario ajeno al proyecto', async () => {
    (prisma.project.findUnique as any).mockResolvedValue({
      ...accessProject,
      projectUsers: [],
      is_confidential: false,
    });

    await expect(
      listProposalVersions(
        { ...piUser, role: 'PRINCIPAL_INVESTIGATOR' },
        10,
      ),
    ).rejects.toMatchObject({
      code: PROPOSAL_VERSION_ERROR_CODES.FORBIDDEN,
      httpStatus: 403,
    });
  });
});

describe('proposalVersionState', () => {
  it('habilita la subida cuando el comite pidio correcciones', async () => {
    const state = await proposalVersionState(piUser, 10);
    expect(state).toMatchObject({
      canUpload: true,
      blockedReason: null,
      versionsUsed: 1,
      remainingVersions: 4,
      nextVersionNumber: 2,
      maxVersions: 5,
    });
  });

  it('bloquea cuando se agotaron las versiones', async () => {
    (prisma.project.findUnique as any).mockResolvedValue({
      ...mockProject,
      proposalVersions: [{ version_number: 5 }],
    });

    const state = await proposalVersionState(piUser, 10);
    expect(state.canUpload).toBe(false);
    expect(state.blockedReason).toBe('VERSION_LIMIT_REACHED');
  });
});
