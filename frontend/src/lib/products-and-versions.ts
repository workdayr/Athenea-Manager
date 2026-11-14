import { gql } from '@apollo/client';
import { getApolloClient } from './apollo-client';
import type { ProjectDocument } from './documents';

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

export interface ProposalVersion {
  versionId: string;
  projectId: number;
  versionNumber: number;
  submittedBy: string;
  submitterName: string | null;
  submittedAt: string;
  status: string;
  committeeComments: string | null;
  createdAt: string;
  documents: ProjectDocument[];
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

export const PROPOSAL_VERSIONS_QUERY = gql`
  query ProposalVersions($projectId: Int!) {
    proposalVersions(projectId: $projectId) {
      versionId
      projectId
      versionNumber
      submittedBy
      submitterName
      submittedAt
      status
      committeeComments
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

export async function uploadProposalVersion(
  projectId: number,
  comment: string,
  filesWithTypes: Array<{ file: File; docType: string }>,
): Promise<ProposalVersion> {
  const formData = new FormData();
  if (comment) formData.append('comment', comment);

  const docTypes = filesWithTypes.map((f) => f.docType);
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
      if (body.message) msg = body.message;
    } catch {}
    throw new Error(msg);
  }

  return (await response.json()) as ProposalVersion;
}
