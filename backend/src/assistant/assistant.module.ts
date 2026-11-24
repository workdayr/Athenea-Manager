import { Module } from '@nestjs/common';
import { AssistantResolver } from './assistant.resolver.js';
import { AssistantService } from './assistant.service.js';

/**
 * F2-08 / RF-018: modulo del Asistente Virtual RAG.
 * No importa nada mas: usa Prisma y `fetch` contra `ai-service`.
 */
@Module({
  providers: [AssistantResolver, AssistantService],
})
export class AssistantModule {}
