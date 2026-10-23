/**
 * US 4.1 / RF-005: consulta y configuracion de la visibilidad de los
 * documentos del proyecto.
 *
 * El backend aplica las reglas de negocio (documentos de revision
 * obligatoria y proyectos terminales); este modulo solo transporta y
 * presenta. Nunca se expone `file_url`.
 */

import { gql } from '@apollo/client';
import { getApolloClient } from './apollo-client';

/** Valores del enum DocumentVisibility del backend. */
export type DocumentVisibility =
  | 'TEAM_ONLY'
  | 'SHARED_WITH_ADMINISTRATION';

export type ProjectDocumentType =
  | 'HYPOTHESIS'
  | 'ABSTRACT'
  | 'METHODOLOGY'
  | 'RATIONALE'
  | 'RESULTS'
  | 'ETHICS_APPROVAL'
  | 'EVIDENCE';

export interface ProjectDocument {
  documentId: number;
  projectId: number;
  docType: ProjectDocumentType;
  visibility: DocumentVisibility;
  fileName: string | null;
  fileSize: number | null;
  version: number;
  uploadedAt: string;
  mandatoryReview: boolean;
  canChangeVisibility: boolean;
}

export const DOC_TYPE_LABELS: Record<ProjectDocumentType, string> = {
  HYPOTHESIS: 'Hipótesis',
  ABSTRACT: 'Resumen / Abstract',
  METHODOLOGY: 'Protocolo metodológico',
  RATIONALE: 'Justificación',
  RESULTS: 'Resultados',
  ETHICS_APPROVAL: 'Aprobación de ética',
  EVIDENCE: 'Evidencia de trabajo',
};

export const VISIBILITY_OPTIONS: Array<{
  value: DocumentVisibility;
  label: string;
  description: string;
}> = [
  {
    value: 'TEAM_ONLY',
    label: 'Solo equipo',
    description: 'La administración no puede ver este documento.',
  },
  {
    value: 'SHARED_WITH_ADMINISTRATION',
    label: 'Equipo + Administración',
    description: 'Visible para el equipo y para la administración.',
  },
];

export function visibilityLabel(visibility: DocumentVisibility): string {
  return (
    VISIBILITY_OPTIONS.find((option) => option.value === visibility)?.label ??
    visibility
  );
}

export function documentTypeLabel(docType: ProjectDocumentType): string {
  return DOC_TYPE_LABELS[docType] ?? docType;
}

/** Tamano legible para la tabla del expediente. */
export function formatFileSize(bytes: number | null): string {
  if (!bytes || bytes <= 0) {
    return '—';
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const PROJECT_DOCUMENTS_QUERY = gql`
  query ProjectDocuments($projectId: Int!) {
    projectDocuments(projectId: $projectId) {
      documentId
      projectId
      docType
      visibility
      fileName
      fileSize
      version
      uploadedAt
      mandatoryReview
      canChangeVisibility
    }
  }
`;

export const SET_DOCUMENT_VISIBILITY_MUTATION = gql`
  mutation SetDocumentVisibility(
    $projectId: Int!
    $documentId: Int!
    $visibility: DocumentVisibility!
  ) {
    setDocumentVisibility(
      projectId: $projectId
      documentId: $documentId
      visibility: $visibility
    ) {
      documentId
      visibility
      mandatoryReview
      canChangeVisibility
    }
  }
`;

/** Lista los documentos visibles para el usuario segun su rol. */
export async function fetchProjectDocuments(
  projectId: number,
): Promise<ProjectDocument[]> {
  const result = await getApolloClient().query<{
    projectDocuments: ProjectDocument[];
  }>({
    query: PROJECT_DOCUMENTS_QUERY,
    variables: { projectId },
    fetchPolicy: 'network-only',
  });
  return result.data?.projectDocuments ?? [];
}

/** Cambia la visibilidad de un documento (solo PI del proyecto). */
export async function updateDocumentVisibility(
  projectId: number,
  documentId: number,
  visibility: DocumentVisibility,
): Promise<ProjectDocument> {
  const result = await getApolloClient().mutate<{
    setDocumentVisibility: ProjectDocument;
  }>({
    mutation: SET_DOCUMENT_VISIBILITY_MUTATION,
    variables: { projectId, documentId, visibility },
  });
  const updated = result.data?.setDocumentVisibility;
  if (!updated) {
    throw new Error('El servidor no devolvió el documento actualizado.');
  }
  return updated;
}

/** Mensaje legible para errores de visibilidad (backend en espanol). */
export function visibilityErrorMessage(error: unknown): string {
  const graphQLError = (
    error as {
      graphQLErrors?: Array<{ message?: string }>;
    }
  )?.graphQLErrors?.[0];
  if (graphQLError?.message) {
    return graphQLError.message;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'No se pudo actualizar la visibilidad. Intenta de nuevo.';
}
