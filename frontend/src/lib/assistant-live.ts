import { gql } from '@apollo/client';
import { getApolloClient } from './apollo-client';
import {
  newAssistantId,
  type AssistantAnswer,
  type AssistantCitation,
  type AssistantGateway,
  type RefusalReason,
} from './assistant';

/**
 * Gateway real del Asistente Virtual RAG.
 *
 * Flujo: navegador -> Next (`/api/graphql`) -> NestJS (`askAssistant`) ->
 * `ai-service` -> Ollama. El navegador nunca habla con el modelo ni con el
 * microservicio; el backend calcula el alcance y firma la llamada interna.
 */

const ASK_ASSISTANT_MUTATION = gql`
  mutation AskAssistant($input: AssistantQueryInput!) {
    askAssistant(input: $input) {
      id
      content
      grounded
      refusalReason
      createdAt
      citations {
        id
        projectId
        documentId
        documentTitle
        documentType
        section
        page
        excerpt
      }
    }
  }
`;

interface AskAssistantData {
  askAssistant: {
    id: string;
    content: string;
    grounded: boolean;
    refusalReason: string | null;
    createdAt: string;
    citations: Array<{
      id: string;
      projectId: number | null;
      documentId: string;
      documentTitle: string;
      documentType: string;
      section: string | null;
      page: number | null;
      excerpt: string;
    }>;
  };
}

const REFUSAL_REASONS: readonly RefusalReason[] = [
  'no_authorized_context',
  'insufficient_information',
  'blocked',
];

function toRefusalReason(value: string | null): RefusalReason | undefined {
  return REFUSAL_REASONS.find((reason) => reason === value);
}

function abortError(): Error {
  const error = new Error('Generación cancelada.');
  error.name = 'AbortError';
  return error;
}

const GENERIC_ERROR =
  'No se pudo consultar al asistente. Intenta de nuevo.';
const NETWORK_TIMEOUT_ERROR =
  'La respuesta tardó demasiado y se cortó la conexión. Intenta de nuevo.';
const NETWORK_ERROR =
  'No se pudo contactar al servidor del asistente. Verifica que el backend y el servicio de IA estén activos.';

/** Mensajes por código para cuando el servidor no envía texto propio. */
const ERROR_MESSAGES: Record<string, string> = {
  AI_SERVICE_TIMEOUT: NETWORK_TIMEOUT_ERROR,
  AI_SERVICE_UNAVAILABLE:
    'El asistente no está disponible en este momento. Intenta de nuevo en unos segundos.',
  AI_NOT_CONFIGURED: 'El asistente no está configurado en este entorno.',
  UNAUTHENTICATED: 'Tu sesión expiró. Vuelve a iniciar sesión.',
  FORBIDDEN: 'Tu rol no tiene permiso para consultar al asistente.',
};

/**
 * Traduce el error de Apollo (GraphQL o red) a un mensaje legible.
 *
 * Sin esto, cualquier fallo terminaba en "revisa tu conexión", aunque el
 * problema real fuera un timeout, el servicio de IA caído o un corte del
 * proxy de Next a los 30s.
 */
function describeAssistantError(error: unknown): Error {
  const candidate = error as {
    graphQLErrors?: ReadonlyArray<{
      message?: string;
      extensions?: { code?: string };
    }>;
    networkError?: unknown;
    message?: string;
  };

  const graphQLErrors = candidate?.graphQLErrors;
  if (graphQLErrors && graphQLErrors.length > 0) {
    const first = graphQLErrors[0];
    const code = first.extensions?.code;
    const message = first.message?.trim() || (code ? ERROR_MESSAGES[code] : undefined);
    return new Error(message || GENERIC_ERROR);
  }

  if (candidate?.networkError) {
    const detail =
      candidate.networkError instanceof Error
        ? candidate.networkError.message
        : String(candidate.networkError);
    if (
      /abort|aborted|timeout|ETIMEDOUT|ECONNRESET|socket hang up|fetch failed|failed to fetch/i.test(
        detail,
      )
    ) {
      return new Error(NETWORK_TIMEOUT_ERROR);
    }
    return new Error(NETWORK_ERROR);
  }

  const message = candidate?.message?.trim();
  return new Error(message || GENERIC_ERROR);
}

export const liveAssistantGateway: AssistantGateway = {
  async ask(input, signal) {
    const client = getApolloClient();

    try {
      const { data } = await client.mutate<AskAssistantData>({
        mutation: ASK_ASSISTANT_MUTATION,
        variables: {
          input: {
            question: input.question,
            conversationId: input.conversationId,
            history: input.history.map(({ role, content }) => ({
              role,
              content,
            })),
          },
        },
        context: {
          fetchOptions: signal ? { signal } : undefined,
        },
        fetchPolicy: 'no-cache',
      });

      if (!data?.askAssistant) {
        throw new Error('El asistente devolvió una respuesta vacía.');
      }

      const answer = data.askAssistant;
      const citations: AssistantCitation[] = answer.citations.map(
        (citation) => ({
          id: citation.id,
          projectId: citation.projectId ?? undefined,
          documentId: citation.documentId,
          documentTitle: citation.documentTitle,
          documentType: citation.documentType,
          section: citation.section ?? undefined,
          page: citation.page ?? undefined,
          excerpt: citation.excerpt,
        }),
      );

      return {
        id: answer.id || newAssistantId('ans'),
        content: answer.content,
        citations,
        grounded: answer.grounded,
        refusalReason: toRefusalReason(answer.refusalReason),
        createdAt: answer.createdAt,
      } satisfies AssistantAnswer;
    } catch (error) {
      if (
        signal?.aborted ||
        (error instanceof Error && error.name === 'AbortError')
      ) {
        throw abortError();
      }
      throw describeAssistantError(error);
    }
  },
};
