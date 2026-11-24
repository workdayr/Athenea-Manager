import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { CurrentUser } from '../projects/current-user.decorator.js';
import {
  SessionGuard,
  type AuthenticatedUser,
} from '../projects/session.guard.js';
import {
  AssistantAnswerGql,
  AssistantQueryInput,
} from './assistant.model.js';
import { AssistantService } from './assistant.service.js';

/**
 * F2-08 / RF-018: consulta del Asistente Virtual RAG.
 * Cualquier usuario autenticado puede preguntar; el alcance se deriva del
 * rol y de sus proyectos, nunca de datos enviados por el cliente.
 */
@Resolver()
@UseGuards(SessionGuard)
export class AssistantResolver {
  constructor(private readonly assistantService: AssistantService) {}

  @Mutation(() => AssistantAnswerGql)
  async askAssistant(
    @Args('input', { type: () => AssistantQueryInput })
    input: AssistantQueryInput,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AssistantAnswerGql> {
    return this.assistantService.ask(user, input);
  }
}
