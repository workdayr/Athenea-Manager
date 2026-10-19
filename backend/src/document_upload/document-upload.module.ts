import { Module } from '@nestjs/common';
import { DocumentUploadController } from './document-upload.controller.js';

@Module({
  controllers: [DocumentUploadController],
})
export class DocumentUploadModule {}
