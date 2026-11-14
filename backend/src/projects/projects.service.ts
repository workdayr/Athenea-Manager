import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { ROLES } from '../auth/roles.constants.js';
import { submitProposalToCall } from '../calls/calls.service.js';
import { prisma } from '../db/prisma.js';
import type { DocType, Prisma } from '../generated/prisma/client.js';
import { applyStatusTransition } from './project-lifecycle.service.js';
import { canViewConfidentialProject } from './project-visibility.policy.js';
import {
  ACTIVE_PROJECT_STATUSES,
  PROJECT_ERROR_CODES,
  REQUIRED_DOCUMENT_TYPES,
} from './projects.constants.js';
import {
  exceedsProjectQuota,
  hasReachedProjectLimit,
  isRequiredDocumentType,
  validatePdfUpload,
  validateRegisterProjectInput,
} from './projects.policy.js';
import { assertProjectWritable } from './project-write-guard.js';
import type { AuthenticatedUser } from './session.guard.js';

/** Error de dominio: se mapea a GraphQL (extensions.code) o a HTTP. */
export class ProjectError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly httpStatus: number,
    readonly field?: string,
  ) {
    super(message);
  }
}

export interface RegisterProjectData {
  title: string;
  objectives: string;
  startDate: Date;
  endDate: Date;
  callId?: number | null;
  researchInvolvesHumans?: boolean;
  researchInvolvesAnimals?: boolean;
  usesSensitiveData?: boolean;
  isConfidential?: boolean;
}

function fail(
  code: string,
  message: string,
  httpStatus: number,
  field?: string,
): never {
  throw new ProjectError(code, message, httpStatus, field);
}

/**
 * US 2.1 / RF-002: registra el proyecto en estado Draft con el solicitante
 * como PI. Aplica BR-001 (rol) y BR-002 (tope de 3 activos).
 */
export async function registerProject(
  user: AuthenticatedUser,
  data: RegisterProjectData,
) {
  if (user.role !== 'PRINCIPAL_INVESTIGATOR') {
    fail(
      PROJECT_ERROR_CODES.FORBIDDEN,
      'Solo un Investigador Principal puede registrar proyectos.',
      403,
    );
  }
  const issues = validateRegisterProjectInput(data);
  if (issues.length > 0) {
    const first = issues[0] as { field: string; message: string };
    fail(PROJECT_ERROR_CODES.VALIDATION_ERROR, first.message, 400, first.field);
  }
  if (data.callId !== undefined && data.callId !== null) {
    // US 2.2 / RF-018: la postulacion a convocatoria pasa por la
    // transaccion con SELECT ... FOR UPDATE (cierre por deadline y cupo).
    // BR-002 se valida ANTES para no consumir cupo de la convocatoria
    // con un PI que ya alcanzo su tope.
    const activeCount = await prisma.project_User.count({
      where: {
        user_id: user.id,
        project_role: 'Principal_Investigator',
        project: { status: { in: [...ACTIVE_PROJECT_STATUSES] } },
      },
    });
    if (hasReachedProjectLimit(activeCount)) {
      fail(
        PROJECT_ERROR_CODES.PI_LIMIT_EXCEEDED,
        'Alcanzaste el limite de 3 proyectos activos (BR-002).',
        403,
      );
    }
    // Devuelve { result, closedByCap }; el resolver solo necesita el proyecto.
    const { result } = await submitProposalToCall(user, {
      title: data.title,
      objectives: data.objectives,
      startDate: data.startDate,
      endDate: data.endDate,
      callId: data.callId,
      researchInvolvesHumans: data.researchInvolvesHumans,
      researchInvolvesAnimals: data.researchInvolvesAnimals,
      usesSensitiveData: data.usesSensitiveData,
      isConfidential: data.isConfidential,
    });
    return result;
  }
  const activeCount = await prisma.project_User.count({
    where: {
      user_id: user.id,
      project_role: 'Principal_Investigator',
      project: { status: { in: [...ACTIVE_PROJECT_STATUSES] } },
    },
  });
  if (hasReachedProjectLimit(activeCount)) {
    fail(
      PROJECT_ERROR_CODES.PI_LIMIT_EXCEEDED,
      'Alcanzaste el limite de 3 proyectos activos (BR-002).',
      403,
    );
  }
  // Creacion anidada en una sola sentencia (atomica sin transaccion
  // interactiva, incompatible con el pooler de Neon en modo transaccion).
  return prisma.project.create({
    data: {
      title: data.title.trim(),
      objectives: data.objectives.trim(),
      start_date: data.startDate,
      end_date: data.endDate,
      call_id: data.callId ?? null,
      is_confidential: data.isConfidential === true,
      research_involves_humans: data.researchInvolvesHumans === true,
      research_involves_animals: data.researchInvolvesAnimals === true,
      uses_sensitive_data: data.usesSensitiveData === true,
      status: 'Draft',
      projectUsers: {
        create: { user_id: user.id, project_role: 'Principal_Investigator' },
      },
    },
    include: {
      call: { select: { title: true } },
      projectUsers: {
        select: {
          project_role: true,
          user: { select: { name: true } },
        },
      },
      milestones: { select: { status: true } },
      expenses: { select: { amount: true } },
    },
  });
}

/** Proyectos donde el usuario es miembro (para "Mis proyectos" y el cupo). */
export function myProjects(user: AuthenticatedUser) {
  return prisma.project.findMany({
    where: { projectUsers: { some: { user_id: user.id } } },
    orderBy: { project_id: 'desc' },
    include: {
      call: { select: { title: true } },
      projectUsers: {
        select: {
          project_role: true,
          user: { select: { name: true } },
        },
      },
      milestones: { select: { status: true } },
      expenses: { select: { amount: true } },
    },
  });
}

/** Conteo de proyectos activos del PI (banner "N de 3" del Figma). */
export function activeProjectCount(user: AuthenticatedUser) {
  return prisma.project_User.count({
    where: {
      user_id: user.id,
      project_role: 'Principal_Investigator',
      project: { status: { in: [...ACTIVE_PROJECT_STATUSES] } },
    },
  });
}

export interface UploadedFile {
  buffer: Buffer;
  originalname: string;
  size: number;
}

function uploadBaseDir(): string {
  return resolve(process.env['UPLOAD_DIR'] ?? join(process.cwd(), 'uploads'));
}

/**
 * RF-002 + RF-016: adjunta los 5 documentos obligatorios en Draft y la
 * aprobacion de etica (BR-006) antes de la aprobacion del proyecto.
 *
 * Valida PDF por Magic Numbers, 25 MB/archivo y cuota de 500 MB/proyecto.
 * Al completar los 5 obligatorios, transiciona Draft -> Proposed en la
 * misma transaccion que crea el documento.
 */
export async function uploadProjectDocument(
  user: AuthenticatedUser,
  projectId: number,
  docType: string,
  file: UploadedFile,
  ip = 'unknown',
) {
  const isRequired = isRequiredDocumentType(docType);
  const isEthicsApproval = docType === 'ethics_approval';
  if (!isRequired && !isEthicsApproval) {
    fail(
      PROJECT_ERROR_CODES.VALIDATION_ERROR,
      `Tipo documental invalido. Requeridos: ${REQUIRED_DOCUMENT_TYPES.join(', ')} o ethics_approval.`,
      400,
      'docType',
    );
  }

  const project = await prisma.project.findUnique({
    where: { project_id: projectId },
  });
  if (!project) {
    fail(PROJECT_ERROR_CODES.NOT_FOUND, 'El proyecto no existe.', 404);
  }
  const membership = await prisma.project_User.findFirst({
    where: {
      project_id: projectId,
      user_id: user.id,
      project_role: 'Principal_Investigator',
    },
  });
  if (!membership) {
    fail(
      PROJECT_ERROR_CODES.FORBIDDEN,
      'Solo el Investigador Principal del proyecto puede adjuntar documentos.',
      403,
    );
  }

  // RF-020: el archivo institucional es inmutable.
  assertProjectWritable(project as { is_read_only?: boolean | null });

  const status = (project as { status: string }).status;
  if (isEthicsApproval) {
    if (!['Draft', 'Proposed', 'Under_Review'].includes(status)) {
      fail(
        PROJECT_ERROR_CODES.CONFLICT,
        'La aprobacion de etica solo puede cargarse antes de que el proyecto sea aprobado.',
        409,
      );
    }
  } else if (status !== 'Draft') {
    fail(
      PROJECT_ERROR_CODES.CONFLICT,
      'El proyecto ya no acepta documentos de registro (debe estar en Draft).',
      409,
    );
  }

  const duplicate = await prisma.projectDocument.findFirst({
    where: { project_id: projectId, doc_type: docType as DocType },
  });
  if (duplicate) {
    fail(
      PROJECT_ERROR_CODES.CONFLICT,
      'Este documento ya fue adjuntado. Usa la revision de propuesta para reemplazarlo.',
      409,
      'docType',
    );
  }
  const pdfIssue = validatePdfUpload(file.buffer, file.size);
  if (pdfIssue) {
    const tooLarge = file.size > 25 * 1024 * 1024;
    fail(
      tooLarge
        ? PROJECT_ERROR_CODES.PAYLOAD_TOO_LARGE
        : PROJECT_ERROR_CODES.UNSUPPORTED_MEDIA_TYPE,
      pdfIssue.message,
      tooLarge ? 413 : 415,
      'file',
    );
  }
  const aggregate = await prisma.projectDocument.aggregate({
    where: { project_id: projectId },
    _sum: { file_size: true },
  });
  if (exceedsProjectQuota(aggregate._sum.file_size ?? 0, file.size)) {
    fail(
      PROJECT_ERROR_CODES.PAYLOAD_TOO_LARGE,
      'El proyecto excede la cuota de 500 MB.',
      413,
      'file',
    );
  }

  const dir = join(uploadBaseDir(), 'projects', String(projectId));
  await mkdir(dir, { recursive: true });
  const fileName = `${docType}_v1_${Date.now()}.pdf`;
  const absolutePath = join(dir, fileName);
  await writeFile(absolutePath, file.buffer);

  try {
    return await prisma.$transaction(async (tx) => {
      const createdDoc = await tx.projectDocument.create({
        data: {
          project_id: projectId,
          doc_type: docType as DocType,
          visibility: 'Shared_with_administration',
          file_url: absolutePath.split(sep).join('/'),
          version: 1,
          file_name: file.originalname,
          file_size: file.size,
        },
      });

      await tx.audit_Log.create({
        data: {
          actor_id: user.id,
          action: `upload_project_document:${docType}`,
          target_id: String(projectId),
          source_ip: ip,
        },
      });

      if (isRequired && status === 'Draft') {
        const requiredCount = await tx.projectDocument.count({
          where: {
            project_id: projectId,
            doc_type: {
              in: [...REQUIRED_DOCUMENT_TYPES] as DocType[],
            },
          },
        });
        if (requiredCount >= REQUIRED_DOCUMENT_TYPES.length) {
          const applied = await applyStatusTransition(tx, {
            projectId,
            actorId: user.id,
            from: 'Draft',
            to: 'Proposed',
            justification: 'Documentos obligatorios completos',
          });
          if (applied.applied) {
            await tx.audit_Log.create({
              data: {
                actor_id: user.id,
                action: 'project_status_transition:Draft->Proposed',
                target_id: String(projectId),
                source_ip: ip,
              },
            });
          }
        }
      }

      return createdDoc;
    });
  } catch (error) {
    await unlink(absolutePath).catch(() => undefined);
    throw error;
  }
}

/**
 * Obs 6: Interfaz pública para que otros módulos (como Evaluation)
 * consulten proyectos sin acoplarse a Prisma.
 */
export async function getProjectWithTeamForEvaluation(projectId: number) {
  return prisma.project.findUnique({
    where: { project_id: projectId },
    include: { projectUsers: { include: { user: true } } },
  });
}

/** Roles institucionales que pueden consultar cualquier proyecto. */
const INSTITUTIONAL_PROJECT_ROLES = [
  ROLES.ADMINISTRATOR,
  ROLES.COORDINATOR,
  ROLES.COMMITTEE,
] as const;

/** Estados en los que aun se pueden corregir las banderas de investigacion. */
const RESEARCH_FLAG_EDITABLE_STATUSES = [
  'Draft',
  'Proposed',
  'Under_Review',
] as const;

const PROJECT_VIEW_INCLUDE = {
  call: { select: { title: true } },
  projectUsers: {
    select: {
      user_id: true,
      project_role: true,
      user: { select: { name: true } },
    },
  },
  milestones: { select: { status: true } },
  expenses: { select: { amount: true } },
} as const;

/**
 * BR-007 / F1-11: consulta de un proyecto aplicando confidencialidad.
 * Un proyecto confidencial solo es visible para su equipo y para los
 * administradores generales.
 */
export async function getProjectForViewer(
  user: AuthenticatedUser,
  projectId: number,
) {
  const project = await prisma.project.findUnique({
    where: { project_id: projectId },
    include: PROJECT_VIEW_INCLUDE,
  });
  if (!project) {
    fail(PROJECT_ERROR_CODES.NOT_FOUND, 'El proyecto no existe.', 404);
  }

  const isMember = project.projectUsers.some(
    (member) => member.user_id === user.id,
  );
  const isInstitutional = (
    INSTITUTIONAL_PROJECT_ROLES as readonly string[]
  ).includes(user.role);
  if (!isMember && !isInstitutional) {
    fail(
      PROJECT_ERROR_CODES.FORBIDDEN,
      'No tienes acceso a este proyecto.',
      403,
    );
  }
  if (
    project.is_confidential &&
    !canViewConfidentialProject(user, isMember)
  ) {
    fail(
      PROJECT_ERROR_CODES.FORBIDDEN,
      'El proyecto es confidencial y solo su equipo y los administradores pueden consultarlo (BR-007).',
      403,
    );
  }

  return project;
}

export interface UpdateProjectSettingsData {
  isConfidential?: boolean;
  researchInvolvesHumans?: boolean;
  researchInvolvesAnimals?: boolean;
  usesSensitiveData?: boolean;
}

/**
 * F1-11: el PI ajusta la confidencialidad y las banderas de investigacion
 * sensible. Las banderas solo pueden corregirse antes de la aprobacion:
 * cambiarlas despues alteraria las compuertas BR-006 ya evaluadas.
 */
export async function updateProjectSettings(
  user: AuthenticatedUser,
  projectId: number,
  input: UpdateProjectSettingsData,
  ip: string,
) {
  const project = await prisma.project.findUnique({
    where: { project_id: projectId },
  });
  if (!project) {
    fail(PROJECT_ERROR_CODES.NOT_FOUND, 'El proyecto no existe.', 404);
  }
  assertProjectWritable(project as { is_read_only?: boolean | null });

  const membership = await prisma.project_User.findFirst({
    where: {
      project_id: projectId,
      user_id: user.id,
      project_role: 'Principal_Investigator',
    },
    select: { projectuser_id: true },
  });
  if (!membership) {
    fail(
      PROJECT_ERROR_CODES.FORBIDDEN,
      'Solo el Investigador Principal del proyecto puede actualizar su configuracion.',
      403,
    );
  }

  const data: Prisma.ProjectUpdateInput = {};
  const changed: string[] = [];

  if (
    input.isConfidential !== undefined &&
    input.isConfidential !== project.is_confidential
  ) {
    data.is_confidential = input.isConfidential;
    changed.push('is_confidential');
  }

  const researchFlags: Array<{
    key: keyof UpdateProjectSettingsData;
    column: 'research_involves_humans' | 'research_involves_animals' | 'uses_sensitive_data';
    current: boolean;
  }> = [
    {
      key: 'researchInvolvesHumans',
      column: 'research_involves_humans',
      current: project.research_involves_humans,
    },
    {
      key: 'researchInvolvesAnimals',
      column: 'research_involves_animals',
      current: project.research_involves_animals,
    },
    {
      key: 'usesSensitiveData',
      column: 'uses_sensitive_data',
      current: project.uses_sensitive_data,
    },
  ];

  for (const flag of researchFlags) {
    const next = input[flag.key];
    if (next === undefined || next === flag.current) {
      continue;
    }
    if (
      !(RESEARCH_FLAG_EDITABLE_STATUSES as readonly string[]).includes(
        project.status,
      )
    ) {
      fail(
        PROJECT_ERROR_CODES.CONFLICT,
        'Las banderas de investigacion sensible solo pueden corregirse antes de que el proyecto sea aprobado.',
        409,
        flag.key,
      );
    }
    data[flag.column] = next;
    changed.push(flag.column);
  }

  if (changed.length === 0) {
    return prisma.project.findUniqueOrThrow({
      where: { project_id: projectId },
      include: PROJECT_VIEW_INCLUDE,
    });
  }

  const updated = await prisma.project.update({
    where: { project_id: projectId },
    data,
    include: PROJECT_VIEW_INCLUDE,
  });

  await prisma.audit_Log.create({
    data: {
      actor_id: user.id,
      action: `update_project_settings:${changed.join(',')}`,
      target_id: String(projectId),
      source_ip: ip,
    },
  });

  return updated;
}
