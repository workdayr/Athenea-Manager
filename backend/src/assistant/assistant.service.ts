import { Injectable, Logger } from '@nestjs/common';
import { GraphQLError } from 'graphql';
import { prisma } from '../db/prisma.js';
import type { AuthenticatedUser } from '../projects/session.guard.js';
import {
  AssistantAnswerGql,
  AssistantCitationGql,
  type AssistantQueryInput,
} from './assistant.model.js';

/** Respuesta cruda del microservicio `ai-service` (camelCase). */
interface AiCitation {
  id: string;
  projectId: number | null;
  documentId: string;
  documentTitle: string;
  documentType: string;
  section: string | null;
  page: number | null;
  excerpt: string;
}

interface AiAnswer {
  answer: string;
  grounded: boolean;
  refusalReason: string | null;
  citations: AiCitation[];
}

const MAX_QUESTION_LENGTH = 2000;
const MAX_HISTORY_MESSAGES = 6;

/**
 * F2-08 / RF-018: puente entre GraphQL y el microservicio RAG local.
 *
 * El backend es el unico que conoce el token del servicio y el unico que
 * calcula el alcance de autorizacion; el `ai-service` solo recibe ids de
 * proyecto ya validados y aplica el filtro en SQL.
 */
@Injectable()
export class AssistantService {
  private readonly logger = new Logger(AssistantService.name);

  async ask(
    user: AuthenticatedUser,
    input: AssistantQueryInput,
  ): Promise<AssistantAnswerGql> {
    const question = input.question?.trim() ?? '';
    if (!question) {
      throw new GraphQLError('La pregunta no puede estar vacía.', {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }
    if (question.length > MAX_QUESTION_LENGTH) {
      throw new GraphQLError(
        `La pregunta supera el máximo de ${MAX_QUESTION_LENGTH} caracteres.`,
        { extensions: { code: 'BAD_USER_INPUT' } },
      );
    }

    const projectIds = await this.authorizedProjectIds(user);
    const answer = await this.request<AiAnswer>('/v1/query', {
      question,
      history: (input.history ?? [])
        .slice(-MAX_HISTORY_MESSAGES)
        .map((message) => ({
          role: message.role === 'assistant' ? 'assistant' : 'user',
          content: message.content.slice(0, 2000),
        })),
      scope: {
        userId: user.id,
        role: user.role,
        projectIds,
      },
      topK: input.topK,
    });

    const result = new AssistantAnswerGql();
    result.id = `ans-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    result.content = answer.answer;
    result.grounded = Boolean(answer.grounded);
    result.refusalReason = answer.refusalReason ?? null;
    result.citations = (answer.citations ?? []).map((citation) => {
      const gql = new AssistantCitationGql();
      gql.id = citation.id;
      gql.projectId = citation.projectId ?? null;
      gql.documentId = citation.documentId;
      gql.documentTitle = citation.documentTitle;
      gql.documentType = citation.documentType;
      gql.section = citation.section ?? null;
      gql.page = citation.page ?? null;
      gql.excerpt = citation.excerpt;
      return gql;
    });
    result.createdAt = new Date();
    return result;
  }

  /**
   * Proyectos sobre los que el usuario puede recibir contexto.
   *
   * Fail-closed: solo proyectos donde figura como miembro. La visibilidad
   * de `ProjectDocument` compartida con administración se añadirá cuando
   * exista la ingesta de PDF; hoy los fragmentos son institucionales
   * (`project_id = NULL`) y visibles para cualquier usuario autenticado.
   */
  private async authorizedProjectIds(
    user: AuthenticatedUser,
  ): Promise<number[]> {
    const memberships = await prisma.project_User.findMany({
      where: { user_id: user.id },
      select: { project_id: true },
    });
    return Array.from(
      new Set(
        memberships.map(
          (row: { project_id: number }) => row.project_id,
        ),
      ),
    );
  }

  private async request<T>(path: string, body: unknown): Promise<T> {
    const baseUrl = process.env['AI_SERVICE_URL'];
    const token = process.env['AI_SERVICE_TOKEN'];
    if (!baseUrl || !token) {
      this.logger.error(
        'AI_SERVICE_URL o AI_SERVICE_TOKEN no están definidos: el asistente no puede responder.',
      );
      throw new GraphQLError(
        'El asistente no está configurado en este entorno.',
        { extensions: { code: 'AI_NOT_CONFIGURED' } },
      );
    }

    const timeoutMs = Number(
      process.env['AI_REQUEST_TIMEOUT_MS'] ?? '90000',
    );
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 90000,
    );

    try {
      const response = await fetch(`${baseUrl.replace(/\/+$/, '')}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-AI-Token': token,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        this.logger.warn(
          `ai-service respondió ${response.status} en ${path}: ${detail.slice(0, 300)}`,
        );
        throw new GraphQLError(
          'El asistente no está disponible en este momento. Intenta de nuevo.',
          { extensions: { code: 'AI_SERVICE_UNAVAILABLE' } },
        );
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof GraphQLError) {
        throw error;
      }
      const aborted =
        error instanceof Error &&
        (error.name === 'AbortError' || error.name === 'TimeoutError');
      this.logger.error(
        aborted
          ? `ai-service no respondió en ${timeoutMs} ms (${path}).`
          : `Error al llamar a ai-service (${path}): ${String(error)}`,
      );
      throw new GraphQLError(
        aborted
          ? 'El asistente tardó demasiado en responder. Intenta de nuevo.'
          : 'El asistente no está disponible en este momento. Intenta de nuevo.',
        {
          extensions: {
            code: aborted ? 'AI_SERVICE_TIMEOUT' : 'AI_SERVICE_UNAVAILABLE',
          },
        },
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
