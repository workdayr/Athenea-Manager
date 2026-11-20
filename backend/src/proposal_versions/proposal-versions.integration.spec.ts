import 'dotenv/config';
import { rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';

vi.mock('../document_upload/antivirus.service.js', () => ({
  antivirus: { scan: vi.fn().mockResolvedValue('ok') },
}));

// El aviso al comite se cubre en las pruebas unitarias; aqui evitamos
// notificar a usuarios reales de la base compartida.
vi.mock('../notifications/notifications.service.js', () => ({
  notifyRole: vi.fn().mockResolvedValue([]),
}));

import { prisma } from '../db/prisma.js';
import type { AuthenticatedUser } from '../projects/session.guard.js';
import { PROPOSAL_VERSION_ERROR_CODES } from './proposal-versions.constants.js';
import {
  listProposalVersions,
  proposalVersionState,
  uploadRevisedProposal,
} from './proposal-versions.service.js';

/**
 * Integracion real contra PostgreSQL del historial de versiones (US 3.2):
 * la propuesta inicial queda como version 1, el PI sube la version 2 tras un
 * dictamen que pide correcciones y el estado expone el cupo restante.
 *
 * El escaneo antivirus y la notificacion al comite se sustituyen para no
 * depender de ClamAV ni escribir avisos en una base compartida. Los datos
 * son unicos por ejecucion y se eliminan en `afterAll`.
 */

let dbReady = false;
try {
  await prisma.$queryRaw`SELECT 1`;
  dbReady = true;
} catch {
  dbReady = false;
}

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const createdUserIds: string[] = [];
const createdEmails: string[] = [];
const createdProjectIds: number[] = [];

const pdfBuffer = Buffer.from('%PDF-1.4 contenido de la version revisada');

async function createUser(
  role: 'PRINCIPAL_INVESTIGATOR' | 'COMMITTEE',
  label: string,
): Promise<AuthenticatedUser> {
  const id = `it-version-${label}-${suffix}`;
  const email = `${id}@unipolidgo.edu.mx`;
  const name = `Prueba ${label}`;
  await prisma.user.create({ data: { id, name, email, role } });
  createdUserIds.push(id);
  createdEmails.push(email);
  return { id, email, name, role };
}

/**
 * Deja el proyecto en el escenario del requisito: propuesta inicial (v1)
 * ya sometida y un dictamen del comite que solicita correcciones.
 */
async function seedProjectWithRevisionRequired(
  pi: AuthenticatedUser,
  reviewer: AuthenticatedUser,
): Promise<number> {
  const project = await prisma.project.create({
    data: {
      title: `Propuesta versionada ${suffix}`,
      objectives: 'Objetivo de la prueba de integracion de versiones.',
      start_date: new Date('2026-12-01T00:00:00.000Z'),
      end_date: new Date('2027-06-01T00:00:00.000Z'),
      status: 'Under_Review',
      is_confidential: false,
      status_changed_at: new Date(),
    },
    select: { project_id: true },
  });
  createdProjectIds.push(project.project_id);

  await prisma.project_User.createMany({
    data: [
      {
        project_id: project.project_id,
        user_id: pi.id,
        project_role: 'Principal_Investigator',
      },
      {
        project_id: project.project_id,
        user_id: reviewer.id,
        project_role: 'Co_Investigator',
      },
    ],
  });

  const evaluation = await prisma.proposal_Evaluation.create({
    data: {
      project_id: project.project_id,
      reviewer_id: reviewer.id,
      decision: 'Revision_Required',
      justification: 'Ampliar la metodologia y la muestra del estudio.',
    },
    select: { evaluation_id: true },
  });

  const version = await prisma.proposal_Version.create({
    data: {
      project_id: project.project_id,
      version_number: 1,
      submitted_by: pi.id,
      status: 'Under_Review',
      submitted_at: new Date('2026-11-01T10:00:00.000Z'),
    },
    select: { version_id: true },
  });

  await prisma.proposal_Version.update({
    where: { version_id: version.version_id },
    data: { evaluation_id: evaluation.evaluation_id },
  });

  await prisma.projectDocument.create({
    data: {
      project_id: project.project_id,
      proposal_version_id: version.version_id,
      doc_type: 'methodology',
      visibility: 'Shared_with_administration',
      file_url: 'uploads/projects/prueba/metodologia_v1.pdf',
      version: 1,
      file_name: 'metodologia_v1.pdf',
      file_size: 1024,
    },
  });

  return project.project_id;
}

function uploadData(projectId: number) {
  return {
    projectId,
    comment: 'Se amplio la metodologia y se ajusto la muestra.',
    files: [
      {
        docType: 'methodology',
        buffer: pdfBuffer,
        originalname: 'metodologia_v2.pdf',
        size: pdfBuffer.length,
      },
    ],
  };
}

afterAll(async () => {
  if (!dbReady) {
    return;
  }

  for (const projectId of createdProjectIds) {
    const dir = join(
      resolve(process.env['UPLOAD_DIR'] ?? join(process.cwd(), 'uploads')),
      'projects',
      String(projectId),
    );
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }

  await prisma.projectDocument.deleteMany({
    where: { project_id: { in: createdProjectIds } },
  });
  await prisma.proposal_Version.deleteMany({
    where: { project_id: { in: createdProjectIds } },
  });
  await prisma.decision_Report.deleteMany({
    where: { evaluation: { project_id: { in: createdProjectIds } } },
  });
  await prisma.proposal_Evaluation.deleteMany({
    where: { project_id: { in: createdProjectIds } },
  });
  await prisma.project_Status_Transition.deleteMany({
    where: { project_id: { in: createdProjectIds } },
  });
  await prisma.project_User.deleteMany({
    where: { project_id: { in: createdProjectIds } },
  });
  await prisma.project.deleteMany({
    where: { project_id: { in: createdProjectIds } },
  });
  await prisma.email_Outbox.deleteMany({
    where: { recipient: { in: createdEmails } },
  });
  await prisma.notification.deleteMany({
    where: { user_id: { in: createdUserIds } },
  });
  await prisma.audit_Log.deleteMany({
    where: {
      OR: [
        { actor_id: { in: createdUserIds } },
        { target_id: { in: createdProjectIds.map(String) } },
      ],
    },
  });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.$disconnect();
});

describe.skipIf(!dbReady)(
  'Historial de versiones de propuesta (integracion)',
  () => {
    it('registra la version 2 y la lista antes de la propuesta inicial', async () => {
      const pi = await createUser('PRINCIPAL_INVESTIGATOR', 'pi');
      const reviewer = await createUser('COMMITTEE', 'revisor');
      const projectId = await seedProjectWithRevisionRequired(pi, reviewer);

      const version = await uploadRevisedProposal(
        pi,
        uploadData(projectId) as never,
        '127.0.0.1',
      );

      expect(version.versionNumber).toBe(2);
      expect(version.status).toBe('Under_Review');
      expect(version.decision).toBeNull();
      expect(version.submitterComment).toBe(
        'Se amplio la metodologia y se ajusto la muestra.',
      );
      expect(version.committeeComments).toBe(
        'Ampliar la metodologia y la muestra del estudio.',
      );
      expect(version.documents).toHaveLength(1);

      const versions = await listProposalVersions(pi, projectId);
      expect(versions.map((row) => row.versionNumber)).toEqual([2, 1]);
      expect(versions[0]?.documents[0]?.fileName).toBe('metodologia_v2.pdf');
      expect(versions[1]?.documents[0]?.fileName).toBe('metodologia_v1.pdf');

      const state = await proposalVersionState(pi, projectId);
      expect(state).toMatchObject({
        maxVersions: 5,
        versionsUsed: 2,
        remainingVersions: 3,
        nextVersionNumber: 3,
        canUpload: true,
        blockedReason: null,
      });
    });

    it('bloquea la subida a un investigador ajeno al proyecto', async () => {
      const pi = await createUser('PRINCIPAL_INVESTIGATOR', 'pi-ajeno');
      const reviewer = await createUser('COMMITTEE', 'revisor-ajeno');
      const outsider = await createUser(
        'PRINCIPAL_INVESTIGATOR',
        'intruso',
      );
      const projectId = await seedProjectWithRevisionRequired(pi, reviewer);

      await expect(
        uploadRevisedProposal(
          outsider,
          uploadData(projectId) as never,
          '127.0.0.1',
        ),
      ).rejects.toMatchObject({
        code: PROPOSAL_VERSION_ERROR_CODES.FORBIDDEN,
      });

      await expect(listProposalVersions(outsider, projectId)).rejects.toMatchObject(
        { code: PROPOSAL_VERSION_ERROR_CODES.FORBIDDEN },
      );
    });

    it('respeta el limite de 5 versiones incluida la propuesta inicial', async () => {
      const pi = await createUser('PRINCIPAL_INVESTIGATOR', 'pi-limite');
      const reviewer = await createUser('COMMITTEE', 'revisor-limite');
      const projectId = await seedProjectWithRevisionRequired(pi, reviewer);

      await prisma.proposal_Version.createMany({
        data: [2, 3, 4, 5].map((versionNumber) => ({
          project_id: projectId,
          version_number: versionNumber,
          submitted_by: pi.id,
          status: 'Under_Review' as const,
        })),
      });

      await expect(
        uploadRevisedProposal(
          pi,
          uploadData(projectId) as never,
          '127.0.0.1',
        ),
      ).rejects.toMatchObject({
        code: PROPOSAL_VERSION_ERROR_CODES.VERSION_LIMIT_REACHED,
      });

      const state = await proposalVersionState(pi, projectId);
      expect(state).toMatchObject({
        versionsUsed: 5,
        remainingVersions: 0,
        canUpload: false,
        blockedReason: 'VERSION_LIMIT_REACHED',
      });
    });
  },
);
