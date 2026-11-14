import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { GraphQLError } from 'graphql';
import { ROLES } from '../auth/roles.constants.js';
import { prisma } from '../db/prisma.js';
import type { InvitationStatus, ProjectRole } from '../generated/prisma/client.js';
import { notifyUser } from '../notifications/notifications.service.js';
import { assertProjectWritable } from '../projects/project-write-guard.js';
import type { AuthenticatedUser } from '../projects/session.guard.js';
import {
  INVITATION_TTL_DAYS,
  invitationExpiresAt,
  isInvitableProjectRole,
  isInvitationExpired,
  isValidInvitationEmail,
  normalizeInvitationEmail,
  TEAM_ERROR_CODES,
} from './teams.constants.js';

export class TeamError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly httpStatus: number,
    readonly field?: string,
  ) {
    super(message);
  }
}

function fail(
  code: string,
  message: string,
  httpStatus: number,
  field?: string,
): never {
  throw new TeamError(code, message, httpStatus, field);
}

export interface TeamMemberView {
  userId: string;
  name: string;
  email: string;
  projectRole: string;
}

export interface TeamInvitationView {
  invitationId: number;
  email: string;
  projectRole: string;
  status: string;
  expiresAt: Date;
  createdAt: Date;
  acceptedAt: Date | null;
}

interface ProjectWithTeam {
  project_id: number;
  title: string;
  is_confidential: boolean;
  is_read_only: boolean | null;
  projectUsers: { user_id: string; project_role: string }[];
}

const INSTITUTIONAL_READERS: string[] = [
  ROLES.ADMINISTRATOR,
  ROLES.COORDINATOR,
  ROLES.COMMITTEE,
];

async function loadProject(projectId: number): Promise<ProjectWithTeam> {
  const project = await prisma.project.findUnique({
    where: { project_id: projectId },
    select: {
      project_id: true,
      title: true,
      is_confidential: true,
      is_read_only: true,
      projectUsers: { select: { user_id: true, project_role: true } },
    },
  });
  if (!project) {
    fail(TEAM_ERROR_CODES.NOT_FOUND, 'El proyecto no existe.', 404);
  }
  return project;
}

function isMember(user: AuthenticatedUser, project: ProjectWithTeam): boolean {
  return project.projectUsers.some((member) => member.user_id === user.id);
}

/** RF-011: lectura para el equipo e instancias institucionales. */
function assertCanRead(
  user: AuthenticatedUser,
  project: ProjectWithTeam,
): void {
  const member = isMember(user, project);
  if (!member && !INSTITUTIONAL_READERS.includes(user.role)) {
    fail(
      TEAM_ERROR_CODES.FORBIDDEN,
      'No tienes acceso al equipo de este proyecto.',
      403,
    );
  }
  // BR-007: confidencial solo para equipo y administracion.
  if (
    project.is_confidential &&
    !member &&
    user.role !== ROLES.ADMINISTRATOR
  ) {
    fail(
      TEAM_ERROR_CODES.FORBIDDEN,
      'El proyecto es confidencial y solo su equipo y la administracion pueden consultarlo (BR-007).',
      403,
    );
  }
}

/** RF-011: solo el PI del proyecto o un administrador gestionan el equipo. */
function assertCanManage(
  user: AuthenticatedUser,
  project: ProjectWithTeam,
): void {
  const isPrincipalInvestigator = project.projectUsers.some(
    (member) =>
      member.user_id === user.id &&
      member.project_role === 'Principal_Investigator',
  );
  if (!isPrincipalInvestigator && user.role !== ROLES.ADMINISTRATOR) {
    fail(
      TEAM_ERROR_CODES.FORBIDDEN,
      'Solo el Investigador Principal del proyecto puede gestionar su equipo.',
      403,
    );
  }
}

function toMemberView(row: {
  user_id: string;
  project_role: string;
  user: { name: string; email: string };
}): TeamMemberView {
  return {
    userId: row.user_id,
    name: row.user.name,
    email: row.user.email,
    projectRole: row.project_role,
  };
}

function toInvitationView(row: {
  invitation_id: number;
  email: string;
  project_role: string;
  status: string;
  expires_at: Date;
  created_at: Date;
  accepted_at: Date | null;
}): TeamInvitationView {
  return {
    invitationId: row.invitation_id,
    email: row.email,
    projectRole: row.project_role,
    status: row.status,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    acceptedAt: row.accepted_at,
  };
}

function invitationEmailBody(projectTitle: string, token: string): string {
  const origin = (process.env['FRONTEND_ORIGIN'] ?? 'http://localhost:3000')
    .replace(/\/+$/, '');
  return [
    `Has sido invitado a participar en el proyecto "${projectTitle}" en Athenea Manager.`,
    '',
    `Acepta la invitacion desde: ${origin}/invitations/${token}`,
    `La invitacion caduca en ${INVITATION_TTL_DAYS} dias.`,
    '',
    'Si no esperabas esta invitacion, puedes ignorar este correo.',
  ].join('\n');
}

@Injectable()
export class TeamsService {
  /** RF-011: integrantes actuales del proyecto. */
  async listMembers(
    user: AuthenticatedUser,
    projectId: number,
  ): Promise<TeamMemberView[]> {
    const project = await loadProject(projectId);
    assertCanRead(user, project);
    const rows = await prisma.project_User.findMany({
      where: { project_id: projectId },
      orderBy: { projectuser_id: 'asc' },
      include: { user: { select: { name: true, email: true } } },
    });
    return rows.map(toMemberView);
  }

  /** RF-011: invitaciones del proyecto (sin exponer el token). */
  async listInvitations(
    user: AuthenticatedUser,
    projectId: number,
  ): Promise<TeamInvitationView[]> {
    const project = await loadProject(projectId);
    assertCanManage(user, project);
    const rows = await prisma.team_Invitation.findMany({
      where: { project_id: projectId },
      orderBy: { created_at: 'desc' },
      take: 50,
    });
    return rows.map(toInvitationView);
  }

  /** RF-011 / BR-010: invita a un investigador o asistente al proyecto. */
  async invite(
    user: AuthenticatedUser,
    projectId: number,
    input: {
      email: string;
      projectRole: string;
      affidavitSigned: boolean;
    },
    ip: string,
  ): Promise<TeamInvitationView> {
    const project = await loadProject(projectId);
    assertCanManage(user, project);
    assertProjectWritable({ is_read_only: project.is_read_only });

    if (!input.affidavitSigned) {
      fail(
        TEAM_ERROR_CODES.AFFIDAVIT_REQUIRED,
        'Debes declarar la ausencia de conflicto familiar antes de invitar (BR-010).',
        400,
        'affidavitSigned',
      );
    }
    const email = normalizeInvitationEmail(input.email ?? '');
    if (!isValidInvitationEmail(email)) {
      fail(
        TEAM_ERROR_CODES.VALIDATION_ERROR,
        'El correo electronico no es valido.',
        400,
        'email',
      );
    }
    if (email === user.email.toLowerCase()) {
      fail(
        TEAM_ERROR_CODES.VALIDATION_ERROR,
        'No puedes invitarte a ti mismo al proyecto.',
        400,
        'email',
      );
    }
    if (!isInvitableProjectRole(input.projectRole)) {
      fail(
        TEAM_ERROR_CODES.VALIDATION_ERROR,
        'Rol de proyecto invalido. Solo se puede invitar como Co_Investigator o Assistant.',
        400,
        'projectRole',
      );
    }

    const existingMember = await prisma.project_User.findFirst({
      where: {
        project_id: projectId,
        user: { email: { equals: email, mode: 'insensitive' } },
      },
      select: { projectuser_id: true },
    });
    if (existingMember) {
      fail(
        TEAM_ERROR_CODES.ALREADY_MEMBER,
        'Ese correo ya pertenece al equipo del proyecto.',
        409,
        'email',
      );
    }

    const pending = await prisma.team_Invitation.findFirst({
      where: { project_id: projectId, email, status: 'Pending' },
      select: { invitation_id: true },
    });
    if (pending) {
      fail(
        TEAM_ERROR_CODES.CONFLICT,
        'Ya existe una invitacion pendiente para ese correo.',
        409,
        'email',
      );
    }

    const invitedUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true },
    });
    const token = randomBytes(32).toString('hex');
    const expiresAt = invitationExpiresAt();
    const inviteLink = `/invitations/${token}`;

    return prisma.$transaction(async (tx) => {
      const invitation = await tx.team_Invitation.create({
        data: {
          project_id: projectId,
          email,
          user_id: invitedUser?.id ?? null,
          project_role: input.projectRole as ProjectRole,
          token,
          expires_at: expiresAt,
          created_by: user.id,
          affidavit_signed_at: new Date(),
        },
      });

      await tx.audit_Log.create({
        data: {
          actor_id: user.id,
          action: `team_invitation_sent:${input.projectRole}`,
          target_id: String(invitation.invitation_id),
          source_ip: ip,
        },
      });

      if (invitedUser) {
        await notifyUser(tx, invitedUser.id, {
          type: 'Invitation',
          title: 'Invitacion a un proyecto de investigacion',
          message:
            `${user.name} te invito a participar en "${project.title}" ` +
            `como ${input.projectRole.replace(/_/g, ' ')}.`,
          link: inviteLink,
          subject: `[Athenea Manager] Invitacion al proyecto "${project.title}"`,
          emailBody: invitationEmailBody(project.title, token),
        });
      } else {
        // El invitado aun no tiene cuenta: el correo queda en la outbox
        // para que pueda registrarse y aceptar desde el enlace.
        await tx.email_Outbox.create({
          data: {
            recipient: email,
            subject: `[Athenea Manager] Invitacion al proyecto "${project.title}"`,
            body: invitationEmailBody(project.title, token),
          },
        });
      }

      return toInvitationView(invitation);
    });
  }

  /** RF-011: el usuario autenticado acepta una invitacion por token. */
  async accept(
    user: AuthenticatedUser,
    token: string,
    ip: string,
  ): Promise<{ projectId: number; projectTitle: string }> {
    const normalizedToken = (token ?? '').trim();
    if (normalizedToken.length === 0) {
      fail(
        TEAM_ERROR_CODES.VALIDATION_ERROR,
        'El token de invitacion es obligatorio.',
        400,
        'token',
      );
    }

    const invitation = await prisma.team_Invitation.findUnique({
      where: { token: normalizedToken },
      include: {
        project: {
          select: {
            project_id: true,
            title: true,
            is_read_only: true,
          },
        },
      },
    });
    if (!invitation) {
      fail(
        TEAM_ERROR_CODES.NOT_FOUND,
        'La invitacion no existe o el enlace es invalido.',
        404,
      );
    }

    if (invitation.email.toLowerCase() !== user.email.toLowerCase()) {
      fail(
        TEAM_ERROR_CODES.FORBIDDEN,
        'La invitacion fue enviada a otro correo electronico.',
        403,
      );
    }

    if (invitation.status === 'Revoked') {
      fail(
        TEAM_ERROR_CODES.INVITATION_REVOKED,
        'La invitacion fue revocada por el Investigador Principal.',
        409,
      );
    }
    if (invitation.status === 'Accepted') {
      return {
        projectId: invitation.project.project_id,
        projectTitle: invitation.project.title,
      };
    }
    if (
      invitation.status === 'Expired' ||
      isInvitationExpired(invitation.expires_at)
    ) {
      await prisma.team_Invitation.updateMany({
        where: { invitation_id: invitation.invitation_id, status: 'Pending' },
        data: { status: 'Expired' as InvitationStatus },
      });
      fail(
        TEAM_ERROR_CODES.INVITATION_EXPIRED,
        `La invitacion caduco. Las invitaciones tienen una vigencia de ${INVITATION_TTL_DAYS} dias.`,
        410,
      );
    }

    assertProjectWritable({
      is_read_only: invitation.project.is_read_only,
    });

    return prisma.$transaction(async (tx) => {
      const claimed = await tx.team_Invitation.updateMany({
        where: { invitation_id: invitation.invitation_id, status: 'Pending' },
        data: {
          status: 'Accepted',
          accepted_at: new Date(),
          user_id: user.id,
        },
      });
      if (claimed.count === 0) {
        const current = await tx.team_Invitation.findUnique({
          where: { invitation_id: invitation.invitation_id },
          select: { status: true },
        });
        if (current?.status === 'Accepted') {
          return {
            projectId: invitation.project.project_id,
            projectTitle: invitation.project.title,
          };
        }
        fail(
          TEAM_ERROR_CODES.CONFLICT,
          'La invitacion cambio de estado. Recarga e intenta de nuevo.',
          409,
        );
      }

      const alreadyMember = await tx.project_User.findFirst({
        where: {
          project_id: invitation.project.project_id,
          user_id: user.id,
        },
        select: { projectuser_id: true },
      });
      if (!alreadyMember) {
        await tx.project_User.create({
          data: {
            project_id: invitation.project.project_id,
            user_id: user.id,
            project_role: invitation.project_role,
          },
        });
      }

      await tx.audit_Log.create({
        data: {
          actor_id: user.id,
          action: 'team_invitation_accepted',
          target_id: String(invitation.invitation_id),
          source_ip: ip,
        },
      });

      if (invitation.created_by !== user.id) {
        await notifyUser(tx, invitation.created_by, {
          type: 'Invitation',
          title: 'Invitacion aceptada',
          message: `${user.name} acepto la invitacion al proyecto "${invitation.project.title}".`,
          link: `/projects/${invitation.project.project_id}`,
        });
      }

      return {
        projectId: invitation.project.project_id,
        projectTitle: invitation.project.title,
      };
    });
  }

  /** RF-011: revoca una invitacion pendiente. */
  async revoke(
    user: AuthenticatedUser,
    invitationId: number,
    ip: string,
  ): Promise<TeamInvitationView> {
    const invitation = await prisma.team_Invitation.findUnique({
      where: { invitation_id: invitationId },
      include: { project: { select: { project_id: true } } },
    });
    if (!invitation) {
      fail(
        TEAM_ERROR_CODES.NOT_FOUND,
        'La invitacion no existe.',
        404,
      );
    }
    const project = await loadProject(invitation.project.project_id);
    assertCanManage(user, project);

    if (invitation.status !== 'Pending') {
      fail(
        TEAM_ERROR_CODES.CONFLICT,
        'Solo se pueden revocar invitaciones pendientes.',
        409,
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.team_Invitation.update({
        where: { invitation_id: invitationId },
        data: { status: 'Revoked' },
      });
      await tx.audit_Log.create({
        data: {
          actor_id: user.id,
          action: 'team_invitation_revoked',
          target_id: String(invitationId),
          source_ip: ip,
        },
      });
      return row;
    });

    return toInvitationView(updated);
  }

  /** RF-011: cambia el rol de un integrante (nunca del PI). */
  async updateRole(
    user: AuthenticatedUser,
    projectId: number,
    memberUserId: string,
    projectRole: string,
    ip: string,
  ): Promise<TeamMemberView> {
    const project = await loadProject(projectId);
    assertCanManage(user, project);

    if (!isInvitableProjectRole(projectRole)) {
      fail(
        TEAM_ERROR_CODES.VALIDATION_ERROR,
        'Rol de proyecto invalido. Valores: Co_Investigator, Assistant.',
        400,
        'projectRole',
      );
    }

    const membership = await prisma.project_User.findFirst({
      where: { project_id: projectId, user_id: memberUserId },
      include: { user: { select: { name: true, email: true } } },
    });
    if (!membership) {
      fail(
        TEAM_ERROR_CODES.NOT_FOUND,
        'El usuario no pertenece al equipo del proyecto.',
        404,
      );
    }
    if (membership.project_role === 'Principal_Investigator') {
      fail(
        TEAM_ERROR_CODES.PI_ROLE_IMMUTABLE,
        'El rol del Investigador Principal no puede modificarse desde el equipo.',
        409,
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.project_User.update({
        where: { projectuser_id: membership.projectuser_id },
        data: { project_role: projectRole as ProjectRole },
        include: { user: { select: { name: true, email: true } } },
      });
      await tx.audit_Log.create({
        data: {
          actor_id: user.id,
          action: `team_member_role_changed:${projectRole}`,
          target_id: String(membership.projectuser_id),
          source_ip: ip,
        },
      });
      await notifyUser(tx, memberUserId, {
        type: 'Role',
        title: 'Rol actualizado en el proyecto',
        message:
          `Tu rol en el proyecto "${project.title}" cambio a ` +
          `${projectRole.replace(/_/g, ' ')}.`,
        link: `/projects/${projectId}`,
      });
      return row;
    });

    return toMemberView(updated);
  }
}

/** Mapea errores de dominio a GraphQL conservando el codigo. */
export function toTeamGraphQLError(error: unknown): never {
  if (error instanceof TeamError) {
    throw new GraphQLError(error.message, {
      extensions: { code: error.code, field: error.field ?? null },
    });
  }
  throw error;
}
