import { gql } from '@apollo/client';
import { getApolloClient } from './apollo-client';

/** F2-01 / RF-012: busqueda interna de proyectos, convocatorias y usuarios. */

export type SearchResultType = 'PROJECT' | 'CALL' | 'USER';

export interface SearchResult {
  type: SearchResultType;
  id: string;
  title: string;
  subtitle: string | null;
  link: string | null;
  rank: number;
}

export interface SearchPage {
  items: SearchResult[];
  total: number;
  page: number;
  pageSize: number;
  pageInfo: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export const SEARCH_QUERY = gql`
  query Search(
    $query: String!
    $types: [SearchType!]
    $page: Int
    $pageSize: Int
  ) {
    search(
      query: $query
      types: $types
      page: $page
      pageSize: $pageSize
    ) {
      items {
        type
        id
        title
        subtitle
        link
        rank
      }
      total
      page
      pageSize
      pageInfo {
        page
        pageSize
        total
        totalPages
        hasNextPage
        hasPreviousPage
      }
    }
  }
`;

export const SEARCH_TYPE_LABELS: Record<SearchResultType, string> = {
  PROJECT: 'Proyecto',
  CALL: 'Convocatoria',
  USER: 'Usuario',
};

export async function searchAll(
  query: string,
  types: SearchResultType[] = [],
  page = 1,
  pageSize = 20,
): Promise<SearchPage> {
  const result = await getApolloClient().query<{ search: SearchPage }>({
    query: SEARCH_QUERY,
    variables: {
      query,
      types: types.length > 0 ? types : null,
      page,
      pageSize,
    },
    fetchPolicy: 'network-only',
  });
  if (!result.data?.search) {
    throw new Error('El servidor no devolvio resultados.');
  }
  return result.data.search;
}

export function searchErrorMessage(error: unknown): string {
  const message = (
    error as { graphQLErrors?: Array<{ message?: string }> }
  )?.graphQLErrors?.[0]?.message;
  if (message) {
    return message;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'No se pudo completar la busqueda. Intenta de nuevo.';
}
