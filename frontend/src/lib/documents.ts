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

/** F1-11 / BR-003: estado de revision administrativa. */
export type DocumentReviewStatus = 'Pending' | 'Approved' | 'Rejected';

export const REVIEW_STATUS_LABELS: Record<DocumentReviewStatus, string> = {
  Pending: 'Pendiente de revisión',
  Approved: 'Aprobado',
  Rejected: 'Rechazado',
};

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
  reviewStatus: DocumentReviewStatus;
  reviewedAt: string | null;
  reviewerName: string | null;
  reviewNotes: string | null;
  canReview: boolean;
}

/** F1-11: datos eticos del proyecto para la certificacion BR-012. */
export interface ProjectEthicsInfo {
  projectId: string;
  researchInvolvesHumans: boolean;
  researchInvolvesAnimals: boolean;
  usesSensitiveData: boolean;
  anonymizationCertified: boolean;
  anonymizationCertifiedAt: string | null;
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
      reviewStatus
      reviewedAt
      reviewerName
      reviewNotes
      canReview
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

export const REVIEW_PROJECT_DOCUMENT_MUTATION = gql`
  mutation ReviewProjectDocument(
    $projectId: Int!
    $documentId: Int!
    $decision: DocumentReviewStatus!
    $notes: String
  ) {
    reviewProjectDocument(
      projectId: $projectId
      documentId: $documentId
      decision: $decision
      notes: $notes
    ) {
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
      reviewStatus
      reviewedAt
      reviewerName
      reviewNotes
      canReview
    }
  }
`;

export const PROJECT_ETHICS_QUERY = gql`
  query ProjectEthics($projectId: Int!) {
    project(projectId: $projectId) {
      projectId
      researchInvolvesHumans
      researchInvolvesAnimals
      usesSensitiveData
      anonymizationCertified
      anonymizationCertifiedAt
    }
  }
`;

export const CERTIFY_PROJECT_ANONYMIZATION_MUTATION = gql`
  mutation CertifyProjectAnonymization($projectId: Int!) {
    certifyProjectAnonymization(projectId: $projectId) {
      projectId
      certified
      certifiedAt
    }
  }
`;

/**
 * F1-11 / BR-003: aprueba o rechaza el informe final o la aprobacion de
 * etica. Solo Administracion y Coordinacion.
 */
export async function reviewProjectDocument(
  projectId: number,
  documentId: number,
  decision: 'Approved' | 'Rejected',
  notes: string | null = null,
): Promise<ProjectDocument> {
  const result = await getApolloClient().mutate<{
    reviewProjectDocument: ProjectDocument;
  }>({
    mutation: REVIEW_PROJECT_DOCUMENT_MUTATION,
    variables: { projectId, documentId, decision, notes },
  });
  const updated = result.data?.reviewProjectDocument;
  if (!updated) {
    throw new Error('El servidor no devolvió el documento revisado.');
  }
  return updated;
}

/** F1-11: consulta las banderas eticas y el estado de certificacion. */
export async function fetchProjectEthics(
  projectId: number,
): Promise<ProjectEthicsInfo> {
  const result = await getApolloClient().query<{
    project: ProjectEthicsInfo;
  }>({
    query: PROJECT_ETHICS_QUERY,
    variables: { projectId },
    fetchPolicy: 'network-only',
  });
  const project = result.data?.project;
  if (!project) {
    throw new Error('El servidor no devolvió la información del proyecto.');
  }
  return project;
}

/** F1-11 / BR-012: el PI certifica la anonimizacion de los datasets. */
export async function certifyProjectAnonymization(
  projectId: number,
): Promise<{ certified: boolean; certifiedAt: string }> {
  const result = await getApolloClient().mutate<{
    certifyProjectAnonymization: { certified: boolean; certifiedAt: string };
  }>({
    mutation: CERTIFY_PROJECT_ANONYMIZATION_MUTATION,
    variables: { projectId },
  });
  const certification = result.data?.certifyProjectAnonymization;
  if (!certification) {
    throw new Error('El servidor no confirmó la certificación.');
  }
  return certification;
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

/** Mensaje legible para errores de revision o certificacion (F1-11). */
export function documentActionErrorMessage(error: unknown): string {
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
  return 'No se pudo completar la operación. Intenta de nuevo.';
}

/**
 * F1-05 / RNF-005: Descarga protegida de documentos con token firmado temporal.
 */
export async function downloadProjectDocument(documentId: number): Promise<void> {
  const response = await fetch(`/api/documents/${documentId}/download`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    let msg = 'No se pudo generar el enlace de descarga.';
    try {
      const body = await response.json();
      if (body.message) msg = body.message;
    } catch {}
    throw new Error(msg);
  }

  const { url } = (await response.json()) as { url: string };
  // Crear enlace temporal para disparar la descarga
  const a = document.createElement('a');
  a.href = url;
  a.setAttribute('download', '');
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
