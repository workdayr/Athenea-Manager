import {
  ApolloClient,
  HttpLink,
  InMemoryCache,
  from,
  gql,
} from '@apollo/client';
import { onError } from '@apollo/client/link/error';
import { getStoredToken } from './auth-client';

/**
 * RF-001: link de errores que detecta respuestas FORBIDDEN/UNAUTHENTICATED
 * del backend y redirige a la pagina correspondiente.
 *
 * GraphQL siempre responde HTTP 200, asi que la unica forma de detectar
 * un error de autorizacion es via `graphQLErrors[].extensions.code`
 * (que es lo que emite `RolesGuard` desde el backend).
 *
 * NOTA: se usa `window.location.href` en lugar de `router.push` porque
 * `errorLink` corre fuera de React (sin acceso a hooks). En un flujo de
 * error de autorizacion, un full reload tambien limpia cache y estado
 * residual, que es el comportamiento deseado.
 *
 * NOTA 2: Apollo Client 4 tipa el `error` de `onError` como `ErrorLike`,
 * que no declara `graphQLErrors` ni `networkError` en su firma. En runtime
 * es un `ApolloError` con ambos campos, asi que hacemos un narrowing
 * manual para accederlos de forma segura.
 */
const errorLink = onError(({ error }) => {
  if (typeof window === 'undefined') {
    return;
  }

  const graphQLErrors = (
    error as {
      graphQLErrors?: ReadonlyArray<{
        extensions?: { code?: string };
      }>;
    }
  ).graphQLErrors;

  const networkError = (error as { networkError?: unknown }).networkError;

  if (graphQLErrors) {
    for (const err of graphQLErrors) {
      const code = err.extensions?.code;
      if (code === 'FORBIDDEN') {
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = '/access-denied';
        return;
      }
      if (code === 'UNAUTHENTICATED') {
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = '/login';
        return;
      }
    }
  }

  if (networkError) {
    console.error('[Apollo network error]', networkError);
  }
});

/**
 * Cliente GraphQL contra el backend via proxy same-origin
 * (`/api/graphql` -> backend `/graphql`, ver next.config.ts).
 * La sesion viaja como `Authorization: Bearer <token>`.
 * Se crea por operacion para leer el token vigente (post-login).
 */
export function getApolloClient() {
  const httpLink = new HttpLink({
    uri: '/api/graphql',
    headers: {
      Authorization: `Bearer ${getStoredToken()}`,
    },
  });

  return new ApolloClient({
    link: from([errorLink, httpLink]),
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

export interface MyProjectTeamMember {
  name: string;
  role: string;
}

export interface MyProjectSummary {
  projectId: string;
  title: string;
  objectives: string;
  startDate: string;
  endDate: string;
  status: string;
  callId: number | null;
  piName: string | null;
  callTitle: string | null;
  team: MyProjectTeamMember[];
  milestonesTotal: number;
  milestonesCompleted: number;
  budgetEnabled: boolean;
  budgetSpent: number | null;
  /** RF-020: el proyecto esta archivado en modo solo lectura. */
  isReadOnly: boolean;
  archivedAt: string | null;
}

export const MY_PROJECTS_QUERY = gql`
  query MyProjects {
    myProjects {
      projectId
      title
      objectives
      startDate
      endDate
      status
      callId
      piName
      callTitle
      team {
        name
        role
      }
      milestonesTotal
      milestonesCompleted
      budgetEnabled
      budgetSpent
      isReadOnly
      archivedAt
    }
  }
`;

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