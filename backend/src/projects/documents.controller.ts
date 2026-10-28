import {
  Body,
  Controller,
  HttpException,
  Param,
  ParseIntPipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CurrentUser } from './current-user.decorator.js';
import { MAX_FILE_BYTES } from './projects.constants.js';
import { ProjectReadOnlyError } from './project-write-guard.js';
import {
  ProjectError,
  uploadProjectDocument,
} from './projects.service.js';
import type { AuthenticatedUser } from './session.guard.js';
import { SessionGuard } from './session.guard.js';

/**
 * REST para binarios (RF-016): GraphQL no transporta multipart.
 * `POST /projects/:id/documents` con `file` (PDF) + `docType` (texto).
 */
@Controller('projects')
@UseGuards(SessionGuard)
export class DocumentsController {
  @Post(':id/documents')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_BYTES },
    }),
  )
  async upload(
    @Param('id', ParseIntPipe) projectId: number,
    @Body('docType') docType: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    try {
      if (!file) {
        throw new ProjectError(
          'VALIDATION_ERROR',
          'Adjunta un archivo PDF.',
          400,
          'file',
        );
      }
      return await uploadProjectDocument(
        user,
        projectId,
        (docType ?? '').trim(),
        {
          buffer: file.buffer,
          originalname: file.originalname,
          size: file.size,
        },
      );
    } catch (error) {
      if (
        error instanceof ProjectError ||
        error instanceof ProjectReadOnlyError
      ) {
        throw new HttpException(error.message, error.httpStatus);
      }
      throw error;
    }
  }
}
