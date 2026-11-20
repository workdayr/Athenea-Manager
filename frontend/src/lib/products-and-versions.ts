import { gql } from '@apollo/client';
import { getApolloClient } from './apollo-client';
import { DOC_TYPE_LABELS, type ProjectDocument, type ProjectDocumentType } from './documents';

export type ProductType =
  | 'JOURNAL_ARTICLE'
  | 'CONFERENCE_PRESENTATION'
  | 'SOFTWARE'
  | 'PATENT'
  | 'THESIS';

export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  JOURNAL_ARTICLE: 'Artículo de Revista',
  CONFERENCE_PRESENTATION: 'Ponencia en Congreso',
  SOFTWARE: 'Software Registrado',
  PATENT: 'Patente',
  THESIS: 'Tesis de Grado',
};

export interface ProductAuthor {
  userId: string;
  name: string;
  email: string;
  authorOrder: number;
}

export interface ResearchProduct {
  productId: string;
  projectId: number;
  productType: ProductType;
  urlDoi: string;
  title: string | null;
  createdAt: string;
  authors: ProductAuthor[];
}

export type ProposalVersionDecision =
  | 'Approved'
  | 'Rejected'
  | 'Revision_Required';

export interface ProposalVersion {
  versionId: string;
  projectId: number;
  versionNumber: number;
  submittedBy: string;
  submitterName: string | null;
  submittedAt: string;
  status: string;
  decision: ProposalVersionDecision | null;
  submitterComment: string | null;
  committeeComments: string | null;
  decidedAt: string | null;
  reviewerName: string | null;
  createdAt: string;
  documents: ProjectDocument[];
}

/** Motivos con los que el backend bloquea una nueva version. */
export type ProposalVersionBlockedReason =
  | 'NOT_PRINCIPAL_INVESTIGATOR'
  | 'PROJECT_READ_ONLY'
  | 'REVISION_NOT_REQUIRED'
  | 'VERSION_LIMIT_REACHED';

export interface ProposalVersionState {
  projectId: number;
  maxVersions: number;
  versionsUsed: number;
  remainingVersions: number;
  nextVersionNumber: number;
  canUpload: boolean;
  blockedReason: ProposalVersionBlockedReason | null;
}

/** Tipos documentales que puede llevar una version revisada. */
export const PROPOSAL_DOCUMENT_TYPES: ProjectDocumentType[] = [
  'HYPOTHESIS',
  'ABSTRACT',
  'METHODOLOGY',
  'RATIONALE',
  'RESULTS',
];

/** El backend recibe los tipos en minusculas (enum DocType). */
export function proposalDocTypeValue(docType: ProjectDocumentType): string {
  return docType.toLowerCase();
}

export function proposalDocTypeLabel(docType: ProjectDocumentType): string {
  return DOC_TYPE_LABELS[docType] ?? docType;
}

export const VERSION_DECISION_LABELS: Record<string, string> = {
  Approved: 'Aprobada',
  Rejected: 'Rechazada',
  Revision_Required: 'Requiere correcciones',
  Under_Review: 'En revisión',
};

export function proposalVersionBlockedMessage(
  reason: ProposalVersionBlockedReason | null,
): string | null {
  switch (reason) {
    case 'NOT_PRINCIPAL_INVESTIGATOR':
      return 'Solo el Investigador Principal del proyecto puede subir versiones.';
    case 'PROJECT_READ_ONLY':
      return 'El proyecto está archivado y ya no admite cambios.';
    case 'REVISION_NOT_REQUIRED':
      return 'El comité todavía no ha solicitado correcciones a esta propuesta.';
    case 'VERSION_LIMIT_REACHED':
      return 'Se alcanzó el límite de 5 versiones para este proyecto.';
    default:
      return null;
  }
}

export const PROJECT_PRODUCTS_QUERY = gql`
  query ProjectProducts($projectId: Int!) {
    projectProducts(projectId: $projectId) {
      productId
      projectId
      productType
      urlDoi
      title
      createdAt
      authors {
        userId
        name
        email
        authorOrder
      }
    }
  }
`;

export const REGISTER_RESEARCH_OUTPUT_MUTATION = gql`
  mutation RegisterResearchOutput($input: RegisterResearchOutputInput!) {
    registerResearchOutput(input: $input) {
      productId
      projectId
      productType
      urlDoi
      title
      createdAt
      authors {
        userId
        name
        email
        authorOrder
      }
    }
  }
`;

const PROPOSAL_VERSION_FIELDS = gql`
  fragment ProposalVersionFields on ProposalVersionGql {
    versionId
    projectId
    versionNumber
    submittedBy
    submitterName
    submittedAt
    status
    decision
    submitterComment
    committeeComments
    decidedAt
    reviewerName
    createdAt
    documents {
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

export const PROPOSAL_VERSIONS_QUERY = gql`
  ${PROPOSAL_VERSION_FIELDS}
  query ProposalVersions($projectId: Int!) {
    proposalVersions(projectId: $projectId) {
      ...ProposalVersionFields
    }
  }
`;

export const PROPOSAL_VERSION_STATE_QUERY = gql`
  query ProposalVersionState($projectId: Int!) {
    proposalVersionState(projectId: $projectId) {
      projectId
      maxVersions
      versionsUsed
      remainingVersions
      nextVersionNumber
      canUpload
      blockedReason
    }
  }
`;

export async function fetchProjectProducts(
  projectId: number,
): Promise<ResearchProduct[]> {
  const result = await getApolloClient().query<{
    projectProducts: ResearchProduct[];
  }>({
    query: PROJECT_PRODUCTS_QUERY,
    variables: { projectId },
    fetchPolicy: 'network-only',
  });
  return result.data?.projectProducts ?? [];
}

export async function registerResearchOutput(input: {
  projectId: number;
  productType: ProductType;
  urlDoi: string;
  title?: string;
  authors: string[];
}): Promise<ResearchProduct> {
  const result = await getApolloClient().mutate<{
    registerResearchOutput: ResearchProduct;
  }>({
    mutation: REGISTER_RESEARCH_OUTPUT_MUTATION,
    variables: { input },
  });
  const product = result.data?.registerResearchOutput;
  if (!product) {
    throw new Error('El servidor no devolvió el producto registrado.');
  }
  return product;
}

export async function fetchProposalVersions(
  projectId: number,
): Promise<ProposalVersion[]> {
  const result = await getApolloClient().query<{
    proposalVersions: ProposalVersion[];
  }>({
    query: PROPOSAL_VERSIONS_QUERY,
    variables: { projectId },
    fetchPolicy: 'network-only',
  });
  return result.data?.proposalVersions ?? [];
}

export async function fetchProposalVersionState(
  projectId: number,
): Promise<ProposalVersionState> {
  const result = await getApolloClient().query<{
    proposalVersionState: ProposalVersionState;
  }>({
    query: PROPOSAL_VERSION_STATE_QUERY,
    variables: { projectId },
    fetchPolicy: 'network-only',
  });
  const state = result.data?.proposalVersionState;
  if (!state) {
    throw new Error('El servidor no devolvió el estado de las versiones.');
  }
  return state;
}

export async function uploadProposalVersion(
  projectId: number,
  comment: string,
  filesWithTypes: Array<{ file: File; docType: string }>,
): Promise<ProposalVersion> {
  const formData = new FormData();
  if (comment.trim()) formData.append('comment', comment.trim());

  const docTypes = filesWithTypes.map((item) => item.docType);
  formData.append('docTypes', JSON.stringify(docTypes));

  for (const item of filesWithTypes) {
    formData.append('files', item.file);
  }

  const response = await fetch(`/api/projects/${projectId}/proposal-versions`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    let msg = 'Error al subir la versión de la propuesta.';
    try {
      const body = await response.json();
      if (typeof body.message === 'string') msg = body.message;
    } catch {}
    throw new Error(msg);
  }

  return (await response.json()) as ProposalVersion;
}
