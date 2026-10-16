import {
  ACTIVE_PROJECT_STATUSES,
  MAX_ACTIVE_PROJECTS_PER_PI,
  MAX_FILE_BYTES,
  PDF_MAGIC_BYTES,
  PROJECT_OBJECTIVES_MAX_LENGTH,
  PROJECT_QUOTA_BYTES,
  PROJECT_TITLE_MAX_LENGTH,
  REQUIRED_DOCUMENT_TYPES,
  type RequiredDocumentType,
} from './projects.constants.js';

export interface ProjectValidationIssue {
  field: string;
  message: string;
}

/**
 * Validacion pura de los campos de registro (RF-002). No toca la BD:
 * titulo <= 300, objetivos <= 2000, fin > inicio.
 */
export function validateRegisterProjectInput(input: {
  title: unknown;
  objectives: unknown;
  startDate: unknown;
  endDate: unknown;
  callId?: unknown;
}): ProjectValidationIssue[] {
  const issues: ProjectValidationIssue[] = [];

  if (typeof input.title !== 'string' || input.title.trim().length === 0) {
    issues.push({ field: 'title', message: 'El titulo es obligatorio.' });
  } else if (input.title.trim().length > PROJECT_TITLE_MAX_LENGTH) {
    issues.push({
      field: 'title',
      message: `El titulo no debe exceder ${PROJECT_TITLE_MAX_LENGTH} caracteres.`,
    });
  }

  if (
    typeof input.objectives !== 'string' ||
    input.objectives.trim().length === 0
  ) {
    issues.push({ field: 'objectives', message: 'Los objetivos son obligatorios.' });
  } else if (input.objectives.trim().length > PROJECT_OBJECTIVES_MAX_LENGTH) {
    issues.push({
      field: 'objectives',
      message: `Los objetivos no deben exceder ${PROJECT_OBJECTIVES_MAX_LENGTH} caracteres.`,
    });
  }

  const start = toDate(input.startDate);
  const end = toDate(input.endDate);
  if (!start) {
    issues.push({ field: 'startDate', message: 'La fecha de inicio es invalida.' });
  }
  if (!end) {
    issues.push({ field: 'endDate', message: 'La fecha de fin es invalida.' });
  }
  if (start && end && end <= start) {
    issues.push({
      field: 'endDate',
      message: 'La fecha de fin debe ser posterior a la de inicio.',
    });
  }

  if (
    input.callId !== undefined &&
    input.callId !== null &&
    (!Number.isInteger(input.callId) || (input.callId as number) <= 0)
  ) {
    issues.push({ field: 'callId', message: 'La convocatoria es invalida.' });
  }

  return issues;
}

function toDate(value: unknown): Date | null {
  const date = value instanceof Date ? value : new Date(value as string);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** BR-002: true si el PI ya alcanzo el tope de proyectos activos. */
export function hasReachedProjectLimit(activeCount: number): boolean {
  return activeCount >= MAX_ACTIVE_PROJECTS_PER_PI;
}

/** Cupos restantes del PI (para el banner "N de 3" del Figma). */
export function remainingProjectSlots(activeCount: number): number {
  return Math.max(0, MAX_ACTIVE_PROJECTS_PER_PI - activeCount);
}

/** Indica si un estado cuenta como activo para BR-002. */
export function isActiveProjectStatus(status: string): boolean {
  return (ACTIVE_PROJECT_STATUSES as readonly string[]).includes(status);
}

/** RF-002: el tipo documental es uno de los 5 obligatorios. */
export function isRequiredDocumentType(
  value: unknown,
): value is RequiredDocumentType {
  return (REQUIRED_DOCUMENT_TYPES as readonly string[]).includes(
    value as string,
  );
}

/**
 * RF-016: valida que el buffer sea un PDF real por Magic Numbers (%PDF-)
 * y que respete el limite de 25 MB por archivo.
 */
export function validatePdfUpload(
  buffer: Uint8Array,
  sizeBytes: number,
): ProjectValidationIssue | null {
  if (sizeBytes > MAX_FILE_BYTES) {
    return {
      field: 'file',
      message: 'El archivo excede el maximo de 25 MB por archivo.',
    };
  }
  const magic = PDF_MAGIC_BYTES;
  const matches =
    buffer.length >= magic.length &&
    magic.every((byte, index) => buffer[index] === byte);
  if (!matches) {
    return {
      field: 'file',
      message: 'El archivo no es un PDF valido.',
    };
  }
  return null;
}

/** RNF-005: true si el acumulado del proyecto supera la cuota de 500 MB. */
export function exceedsProjectQuota(
  currentTotalBytes: number,
  newFileBytes: number,
): boolean {
  return currentTotalBytes + newFileBytes > PROJECT_QUOTA_BYTES;
}
