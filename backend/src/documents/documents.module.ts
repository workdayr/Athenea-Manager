import { Module } from '@nestjs/common';
import { DocumentsDownloadController } from './documents-download.controller.js';
import { DocumentReviewResolver } from './document-review.resolver.js';
import { DocumentsResolver } from './documents.resolver.js';

/**
 * US 4.1 / RF-005 + F1-05 + F1-11 / BR-003: visibilidad, descarga segura y revision documental.
 * Los servicios son funciones que usan Prisma directamente, siguiendo el
 * patron de los modulos `projects` y `document_upload`.
 */
@Module({
  controllers: [DocumentsDownloadController],
  providers: [DocumentsResolver, DocumentReviewResolver],
})
export class DocumentsModule {}
