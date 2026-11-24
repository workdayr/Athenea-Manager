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
      if (signal?.aborted) {
        throw abortError();
      }
      throw error instanceof Error
        ? error
        : new Error('No se pudo consultar al asistente.');
    }
  },
};
