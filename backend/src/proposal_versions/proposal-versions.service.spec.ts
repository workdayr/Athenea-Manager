import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../db/prisma.js', () => ({
  prisma: {
    project: { findUnique: vi.fn(), updateMany: vi.fn() },
    projectDocument: { aggregate: vi.fn(), findMany: vi.fn() },
    proposal_Version: { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../notifications/notifications.service.js', () => ({
  notifyRole: vi.fn().mockResolvedValue({}),
}));

import { prisma } from '../db/prisma.js';
import {
  PROPOSAL_VERSION_ERROR_CODES,
} from './proposal-versions.constants.js';
import {
  listProposalVersions,
  uploadRevisedProposal,
} from './proposal-versions.service.js';

const piUser = {
  id: 'u-pi-1',
  email: 'pi@unipolidgo.edu.mx',
  name: 'Investigador Principal',
  role: 'PRINCIPAL_INVESTIGATOR',
};

const pdfBuffer = Buffer.from('%PDF-1.4 sample pdf content');

const mockProject = {
  project_id: 10,
  title: 'Proyecto con Revision Requerida',
  status: 'Under_Review',
  is_read_only: false,
  projectUsers: [{ user_id: 'u-pi-1', project_role: 'Principal_Investigator' }],
  evaluations: [
    {
      evaluation_id: 1,
      decision: 'Revision_Required',
      justification: 'Falta profundizar en la metodologia.',
    },
  ],
  proposalVersions: [],
};

beforeEach(() => {
  vi.resetAllMocks();
  (prisma.project.findUnique as any).mockResolvedValue(mockProject);
  (prisma.projectDocument.aggregate as any).mockResolvedValue({
    _sum: { file_size: 1024 * 1024 },
  });
  (prisma.$transaction as any).mockImplementation(async (callback: any) => {
    const tx = {
      proposal_Version: {
        create: vi.fn().mockResolvedValue({
          version_id: 2,
          project_id: 10,
          version_number: 2,
          submitted_by: 'u-pi-1',
          status: 'Under_Review',
          committee_comments: 'Falta profundizar en la metodologia.',
          created_at: new Date('2026-11-13T21:00:00Z'),
          submitted_at: new Date('2026-11-13T21:00:00Z'),
        }),
      },
      projectDocument: {
        create: vi.fn().mockResolvedValue({
          document_id: 88,
          project_id: 10,
          doc_type: 'methodology',
          visibility: 'Shared_with_administration',
          version: 2,
          file_name: 'methodology_v2.pdf',
          file_size: pdfBuffer.length,
          uploaded_at: new Date('2026-11-13T21:00:00Z'),
          review_status: 'Pending',
          reviewed_at: null,
          review_notes: null,
        }),
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
});

describe('uploadRevisedProposal (RF-004 / UC-004)', () => {
  it('permite al PI subir una version revisada tras Revision_Required', async () => {
    const result = await uploadRevisedProposal(
      piUser,
      {
        projectId: 10,
        comment: 'Se corrigió la metodología conforme al comité.',
        files: [
          {
            docType: 'methodology',
            buffer: pdfBuffer,
            originalname: 'methodology_v2.pdf',
            size: pdfBuffer.length,
          },
        ],
      },
      '127.0.0.1',
    );

    expect(result.versionNumber).toBe(2);
    expect(result.status).toBe('Under_Review');
    expect(result.documents).toHaveLength(1);
    expect(result.committeeComments).toBe('Falta profundizar en la metodologia.');
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
      uploadRevisedProposal(piUser, {
        projectId: 10,
        files: [
          {
            docType: 'methodology',
            buffer: pdfBuffer,
            originalname: 'methodology_v2.pdf',
            size: pdfBuffer.length,
          },
        ],
      }),
    ).rejects.toMatchObject({
      code: PROPOSAL_VERSION_ERROR_CODES.REVISION_NOT_REQUIRED,
      httpStatus: 409,
    });
  });

  it('bloquea si se ha alcanzado el limite maximo de 5 versiones', async () => {
    (prisma.project.findUnique as any).mockResolvedValue({
      ...mockProject,
      proposalVersions: [
        { version_number: 5 },
        { version_number: 4 },
        { version_number: 3 },
        { version_number: 2 },
        { version_number: 1 },
      ],
    });

    await expect(
      uploadRevisedProposal(piUser, {
        projectId: 10,
        files: [
          {
            docType: 'methodology',
            buffer: pdfBuffer,
            originalname: 'methodology_v2.pdf',
            size: pdfBuffer.length,
          },
        ],
      }),
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
      uploadRevisedProposal(piUser, {
        projectId: 10,
        files: [
          {
            docType: 'methodology',
            buffer: pdfBuffer,
            originalname: 'methodology_v2.pdf',
            size: pdfBuffer.length,
          },
        ],
      }),
    ).rejects.toMatchObject({
      code: PROPOSAL_VERSION_ERROR_CODES.FORBIDDEN,
      httpStatus: 403,
    });
  });
});

describe('listProposalVersions', () => {
  it('lista las versiones de la propuesta con sus documentos', async () => {
    (prisma.proposal_Version.findMany as any).mockResolvedValue([
      {
        version_id: 2,
        project_id: 10,
        version_number: 2,
        submitted_by: 'u-pi-1',
        submitted_at: new Date('2026-11-13T21:00:00Z'),
        status: 'Under_Review',
        committee_comments: 'Comentarios',
        created_at: new Date('2026-11-13T21:00:00Z'),
        submitter: { name: 'PI Name' },
        documents: [],
      },
    ]);

    const versions = await listProposalVersions(10);
    expect(versions).toHaveLength(1);
    expect(versions[0]?.versionNumber).toBe(2);
    expect(versions[0]?.submitterName).toBe('PI Name');
  });
});
