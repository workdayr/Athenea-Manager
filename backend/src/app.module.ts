import { Module } from '@nestjs/common';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { GraphQLModule } from '@nestjs/graphql';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { CallsModule } from './calls/calls.module.js';
import { DocumentUploadModule } from './document_upload/document-upload.module.js';
import { DocumentsModule } from './documents/documents.module.js';
import { ProposalEvaluationModule } from './proposal_evaluation/proposal-evaluation.module.js';
import { ProjectsModule } from './projects/projects.module.js';

@Module({
  imports: [
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      // Esquema en memoria (sin archivo generado en el repo).
      autoSchemaFile: true,
      path: '/graphql',
      introspection: process.env['NODE_ENV'] !== 'production',
      context: ({ req }: { req: unknown }) => ({ req }),
      // RNF-010: nunca exponer stacktraces ni detalles internos.
      formatError: (error) => ({
        message: error.message,
        extensions: {
          code: (error.extensions?.['code'] as string) ?? 'INTERNAL_ERROR',
          field: (error.extensions?.['field'] as string | null) ?? null,
        },
      }),
    }),
    ProjectsModule,
    CallsModule,
    ProposalEvaluationModule,
    DocumentUploadModule,
    DocumentsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
