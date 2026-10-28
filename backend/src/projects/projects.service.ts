import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { submitProposalToCall } from '../calls/calls.service.js';
import { prisma } from '../db/prisma.js';
import type { DocType } from '../generated/prisma/client.js';
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
}

const fail = (
  code: string,
  message: string,
  httpStatus: number,
  field?: string,
): never => {
  throw new ProjectError(code, message, httpStatus, field);
};

/**
 * US 2.1 / RF-002: registra el proyecto en estado Proposed con el
 * solicitante como PI. Aplica BR-001 (rol) y BR-002 (tope de 3 activos).
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
      is_confidential: false,
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
 * RF-002 + RF-016: adjunta uno de los 5 documentos obligatorios al proyecto
 * en estado Proposed. Valida PDF por Magic Numbers, 25 MB/archivo y
 * cuota de 500 MB/proyecto. Un archivo por tipo documental.
 */
/**
 * RF-002 + RF-016: adjunta uno de los 5 documentos obligatorios al proyecto
 * Valida PDF por Magic Numbers, 25 MB/archivo y cuota de 500 MB/proyecto. 
 * Un archivo por tipo documental.
 */
export async function uploadProjectDocument(
  user: AuthenticatedUser,
  projectId: number,
  docType: string,
  file: UploadedFile,
) {
  if (!isRequiredDocumentType(docType)) {
    fail(
      PROJECT_ERROR_CODES.VALIDATION_ERROR,
      `Tipo documental invalido. Requeridos: ${REQUIRED_DOCUMENT_TYPES.join(', ')}.`,
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

  // 🚨 CORRECCIÓN (Obs 8): Ahora el proyecto nace en 'Draft', no en 'Proposed'
  if ((project as { status: string }).status !== 'Draft') {
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
    const createdDoc = await prisma.projectDocument.create({
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

    // 🚨 NUEVO (Obs 8): Si ya hay 5 documentos, pasa a Proposed
    const docCount = await prisma.projectDocument.count({
      where: { project_id: projectId },
    });
    
    if (docCount >= 5) {
      await prisma.project.update({
        where: { project_id: projectId },
        data: { status: 'Proposed' },
      });
    }

    return createdDoc;
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