import { ApolloClient, HttpLink, InMemoryCache, gql } from '@apollo/client';
import { getStoredToken } from './auth-client';

/**
 * Cliente GraphQL contra el backend via proxy same-origin
 * (`/api/graphql` -> backend `/graphql`, ver next.config.ts).
 * La sesion viaja como `Authorization: Bearer <token>`.
 * Se crea por operacion para leer el token vigente (post-login).
 */
export function getApolloClient() {
  return new ApolloClient({
    link: new HttpLink({
      uri: '/api/graphql',
      headers: {
        Authorization: `Bearer ${getStoredToken()}`,
      },
    }),
    cache: new InMemoryCache(),
  });
}

export const REGISTER_PROJECT_MUTATION = gql`
  mutation RegisterProject($input: RegisterProjectInput!) {
    registerProject(input: $input) {
      projectId
      title
      status
    }
  }
`;

export const ACTIVE_PROJECT_COUNT_QUERY = gql`
  query ActiveProjectCount {
    activeProjectCount
  }
`;

export interface RegisterProjectResult {
  registerProject: {
    projectId: string;
    title: string;
    status: string;
  };
}

/** Extrae el `extensions.code` del primer error GraphQL. */
export function graphqlErrorCode(error: unknown): string | null {
  const extensions = (
    error as {
      graphQLErrors?: Array<{ extensions?: { code?: string } }>;
    }
  )?.graphQLErrors?.[0]?.extensions;
  return typeof extensions?.code === 'string' ? extensions.code : null;
}

/** Sube un PDF por REST (`POST /api/projects/:id/documents`). */
export async function uploadProjectDocument(
  projectId: string,
  docType: string,
  file: File,
): Promise<void> {
  const form = new FormData();
  form.append('file', file);
  form.append('docType', docType);
  const response = await fetch(`/api/projects/${projectId}/documents`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getStoredToken()}`,
    },
    body: form,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message =
      (body as { message?: string } | null)?.message ??
      `No se pudo subir ${file.name} (HTTP ${response.status}).`;
    throw new Error(message);
  }
}
