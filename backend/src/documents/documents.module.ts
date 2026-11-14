import { Module } from '@nestjs/common';
import { DocumentReviewResolver } from './document-review.resolver.js';
import { DocumentsResolver } from './documents.resolver.js';

/**
 * US 4.1 / RF-005 + F1-11 / BR-003: visibilidad y revision documental.
 * Los servicios son funciones que usan Prisma directamente, siguiendo el
 * patron de los modulos `projects` y `document_upload`.
 */
@Module({
  providers: [DocumentsResolver, DocumentReviewResolver],
})
export class DocumentsModule {}
