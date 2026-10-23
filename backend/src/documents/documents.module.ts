import { Module } from '@nestjs/common';
import { DocumentsResolver } from './documents.resolver.js';

/**
 * US 4.1 / RF-005: visibilidad de documentos del proyecto.
 * Los servicios son funciones puras que usan Prisma directamente,
 * siguiendo el patron de los modulos `projects` y `document_upload`.
 */
@Module({
  providers: [DocumentsResolver],
})
export class DocumentsModule {}
