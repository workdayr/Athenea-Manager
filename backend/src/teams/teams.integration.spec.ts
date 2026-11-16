import 'dotenv/config';
import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../db/prisma.js';
import type { AuthenticatedUser } from '../projects/session.guard.js';
import { TeamsService } from './teams.service.js';

/**
 * Integracion real contra PostgreSQL de equipos e invitaciones
 * (F2-02 / RF-011 / BR-010): token de un solo uso, vigencia, aceptacion por
 * correo, revocacion, auditoria y notificaciones. Tambien cubre los rechazos
 * de affidavit, duplicados y rol PI inmutable.
 *
 * Cada prueba crea su propio proyecto y usuarios con sufijo unico; afterAll
 * elimina todo. Si la base no esta disponible las pruebas se omiten.
 */

let dbReady = false;
try {
  await prisma.$queryRaw`SELECT 1`;
  dbReady = true;
} catch {
  dbReady = false;
}

type TestRole = 'PRINCIPAL_INVESTIGATOR' | 'STUDENT';

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const service = new TeamsService();
const ip = '127.0.0.1';

const userIds: string[] = [];
const emails: string[] = [];
const projectIds: number[] = [];

async function createUser(
  role: TestRole,
  label: string,
): Promise<AuthenticatedUser> {
  const id = `it-team-${label}-${suffix}`;
  const email = `${id}@unipolidgo.edu.mx`;
  const name = `Prueba equipo ${label}`;
  await prisma.user.create({ data: { id, name, email, role } });
  userIds.push(id);
  emails.push(email);
  return { id, email, name, role };
}

async function createProject(
  pi: AuthenticatedUser,
  label: string,
): Promise<number> {
  const project = await prisma.project.create({
    data: {
      title: `Proyecto equipo ${label} ${suffix}`,
      objectives: `Objetivos de la prueba de equipo ${suffix}`,
      start_date: new Date('2026-01-01T00:00:00.000Z'),
      end_date: new Date('2026-12-31T00:00:00.000Z'),
      status: 'Active',
      is_confidential: false,
    },
  });
  projectIds.push(project.project_id);
  await prisma.project_User.create({
    data: {
      project_id: project.project_id,
      user_id: pi.id,
      project_role: 'Principal_Investigator',
    },
  });
  return project.project_id;
}

async function invitationToken(invitationId: number): Promise<string> {
  const row = await prisma.team_Invitation.findUnique({
    where: { invitation_id: invitationId },
    select: { token: true },
  });
  if (!row) {
    throw new Error('La invitacion creada no existe.');
  }
  return row.token;
}

afterAll(async () => {
  if (!dbReady) {
    return;
  }
  await prisma.team_Invitation.deleteMany({
    where: {
      OR: [
        { project_id: { in: projectIds } },
        { created_by: { in: userIds } },
        { email: { in: emails } },
      ],
    },
  });
  await prisma.project_User.deleteMany({
    where: {
      OR: [
        { project_id: { in: projectIds } },
        { user_id: { in: userIds } },
      ],
    },
  });
  await prisma.project.deleteMany({
    where: { project_id: { in: projectIds } },
  });
  await prisma.email_Outbox.deleteMany({
    where: { recipient: { in: emails } },
  });
  await prisma.notification.deleteMany({
    where: { user_id: { in: userIds } },
  });
  await prisma.audit_Log.deleteMany({
    where: { actor_id: { in: userIds } },
  });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

describe.skipIf(!dbReady)(
  'Equipos e invitaciones (integracion, RF-011)',
  () => {
    it('crea una invitacion con token de 7 dias, auditoria y notificacion', async () => {
      const pi = await createUser('PRINCIPAL_INVESTIGATOR', 'pi-alta');
      const invitee = await createUser('STUDENT', 'invitado-alta');
      const projectId = await createProject(pi, 'alta');

      const invitation = await service.invite(
        pi,
        projectId,
        {
          email: invitee.email.toUpperCase(),
          projectRole: 'Assistant',
          affidavitSigned: true,
        },
        ip,
      );

      expect(invitation.email).toBe(invitee.email);
      expect(invitation.projectRole).toBe('Assistant');
      expect(invitation.status).toBe('Pending');
      expect(invitation.acceptedAt).toBeNull();

      const stored = await prisma.team_Invitation.findUnique({
        where: { invitation_id: invitation.invitationId },
      });
      expect(stored?.token).toMatch(/^[a-f0-9]{64}$/);
      const ttlDays =
        (stored!.expires_at.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
      expect(ttlDays).toBeGreaterThan(6.9);
      expect(ttlDays).toBeLessThan(7.1);

      const audit = await prisma.audit_Log.findFirst({
        where: {
          actor_id: pi.id,
          action: 'team_invitation_sent:Assistant',
          target_id: String(invitation.invitationId),
        },
      });
      expect(audit).not.toBeNull();

      const notification = await prisma.notification.findFirst({
        where: { user_id: invitee.id, type: 'Invitation' },
      });
      expect(notification).not.toBeNull();
      expect(notification?.link).toMatch(/^\/invitations\/[a-f0-9]{64}$/);

      const outbox = await prisma.email_Outbox.findFirst({
        where: { notification_id: notification?.notification_id },
      });
      expect(outbox?.recipient).toBe(invitee.email);
      expect(outbox?.status).toBe('Pending');
    });

    it('exige la declaracion de ausencia de conflicto (BR-010)', async () => {
      const pi = await createUser('PRINCIPAL_INVESTIGATOR', 'pi-affidavit');
      const invitee = await createUser('STUDENT', 'invitado-affidavit');
      const projectId = await createProject(pi, 'affidavit');

      await expect(
        service.invite(
          pi,
          projectId,
          {
            email: invitee.email,
            projectRole: 'Assistant',
            affidavitSigned: false,
          },
          ip,
        ),
      ).rejects.toMatchObject({ code: 'AFFIDAVIT_REQUIRED' });

      const count = await prisma.team_Invitation.count({
        where: { project_id: projectId },
      });
      expect(count).toBe(0);
    });

    it('rechaza una invitacion pendiente duplicada', async () => {
      const pi = await createUser('PRINCIPAL_INVESTIGATOR', 'pi-duplicada');
      const invitee = await createUser('STUDENT', 'invitado-duplicada');
      const projectId = await createProject(pi, 'duplicada');

      await service.invite(
        pi,
        projectId,
        {
          email: invitee.email,
          projectRole: 'Assistant',
          affidavitSigned: true,
        },
        ip,
      );

      await expect(
        service.invite(
          pi,
          projectId,
          {
            email: invitee.email,
            projectRole: 'Co_Investigator',
            affidavitSigned: true,
          },
          ip,
        ),
      ).rejects.toMatchObject({ code: 'CONFLICT' });

      const count = await prisma.team_Invitation.count({
        where: { project_id: projectId },
      });
      expect(count).toBe(1);
    });

    it('acepta la invitacion solo con el correo destinatario y crea la membresia', async () => {
      const pi = await createUser('PRINCIPAL_INVESTIGATOR', 'pi-acepta');
      const invitee = await createUser('STUDENT', 'invitado-acepta');
      const outsider = await createUser('STUDENT', 'ajeno-acepta');
      const projectId = await createProject(pi, 'acepta');

      const invitation = await service.invite(
        pi,
        projectId,
        {
          email: invitee.email,
          projectRole: 'Assistant',
          affidavitSigned: true,
        },
        ip,
      );
      const token = await invitationToken(invitation.invitationId);

      await expect(service.accept(outsider, token, ip)).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });

      const accepted = await service.accept(invitee, token, ip);
      expect(accepted.projectId).toBe(projectId);

      const stored = await prisma.team_Invitation.findUnique({
        where: { invitation_id: invitation.invitationId },
      });
      expect(stored?.status).toBe('Accepted');
      expect(stored?.accepted_at).not.toBeNull();

      const membership = await prisma.project_User.findFirst({
        where: { project_id: projectId, user_id: invitee.id },
      });
      expect(membership?.project_role).toBe('Assistant');

      const audit = await prisma.audit_Log.findFirst({
        where: {
          actor_id: invitee.id,
          action: 'team_invitation_accepted',
          target_id: String(invitation.invitationId),
        },
      });
      expect(audit).not.toBeNull();

      const notification = await prisma.notification.findFirst({
        where: { user_id: pi.id, type: 'Invitation' },
      });
      expect(notification?.title).toContain('aceptada');

      // Aceptar de nuevo es idempotente: no duplica la membresia.
      await service.accept(invitee, token, ip);
      const memberships = await prisma.project_User.count({
        where: { project_id: projectId, user_id: invitee.id },
      });
      expect(memberships).toBe(1);
    });

    it('revoca una invitacion pendiente y bloquea su aceptacion', async () => {
      const pi = await createUser('PRINCIPAL_INVESTIGATOR', 'pi-revoca');
      const invitee = await createUser('STUDENT', 'invitado-revoca');
      const projectId = await createProject(pi, 'revoca');

      const invitation = await service.invite(
        pi,
        projectId,
        {
          email: invitee.email,
          projectRole: 'Co_Investigator',
          affidavitSigned: true,
        },
        ip,
      );
      const token = await invitationToken(invitation.invitationId);

      const revoked = await service.revoke(
        pi,
        invitation.invitationId,
        ip,
      );
      expect(revoked.status).toBe('Revoked');

      await expect(service.accept(invitee, token, ip)).rejects.toMatchObject({
        code: 'INVITATION_REVOKED',
      });
      const memberships = await prisma.project_User.count({
        where: { project_id: projectId, user_id: invitee.id },
      });
      expect(memberships).toBe(0);
    });

    it('cambia el rol de un miembro y protege el rol del PI', async () => {
      const pi = await createUser('PRINCIPAL_INVESTIGATOR', 'pi-rol');
      const invitee = await createUser('STUDENT', 'invitado-rol');
      const projectId = await createProject(pi, 'rol');

      const invitation = await service.invite(
        pi,
        projectId,
        {
          email: invitee.email,
          projectRole: 'Assistant',
          affidavitSigned: true,
        },
        ip,
      );
      const token = await invitationToken(invitation.invitationId);
      await service.accept(invitee, token, ip);

      const updated = await service.updateRole(
        pi,
        projectId,
        invitee.id,
        'Co_Investigator',
        ip,
      );
      expect(updated.projectRole).toBe('Co_Investigator');

      const stored = await prisma.project_User.findFirst({
        where: { project_id: projectId, user_id: invitee.id },
      });
      expect(stored?.project_role).toBe('Co_Investigator');

      const audit = await prisma.audit_Log.findFirst({
        where: {
          actor_id: pi.id,
          action: 'team_member_role_changed:Co_Investigator',
        },
      });
      expect(audit).not.toBeNull();

      const notification = await prisma.notification.findFirst({
        where: { user_id: invitee.id, type: 'Role' },
      });
      expect(notification).not.toBeNull();

      await expect(
        service.updateRole(pi, projectId, pi.id, 'Assistant', ip),
      ).rejects.toMatchObject({ code: 'PI_ROLE_IMMUTABLE' });
    });
  },
);
