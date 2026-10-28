import {
  Controller,
  HttpException,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { MAX_FILE_BYTES } from '../projects/projects.constants.js';
import { ProjectReadOnlyError } from '../projects/project-write-guard.js';
import type { AuthenticatedUser } from '../projects/session.guard.js';
import { CurrentUser } from '../projects/current-user.decorator.js';
import { SessionGuard } from '../projects/session.guard.js';
import {
  DocumentUploadError,
  uploadEvidenceDocument,
  type UploadedFile as ServiceUploadedFile,
} from './document-upload.service.js';

/**
 * REST para binarios de evidencia (RF-016): GraphQL no transporta multipart.
 * `POST /projects/:id/evidence` con `file` (PDF/PNG/JPG/XLSX).
 * Cualquier miembro del equipo puede subir (no solo el PI).
 */
@Controller('projects')
@UseGuards(SessionGuard)
export class DocumentUploadController {
  @Post(':id/evidence')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_BYTES },
    }),
  )
  async upload(
    @Param('id', ParseIntPipe) projectId: number,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: { ip?: string },
  ) {
    try {
      if (!file) {
        throw new DocumentUploadError(
          'VALIDATION_ERROR',
          'Adjunta un archivo.',
          400,
          'file',
        );
      }
      return await uploadEvidenceDocument(
        user,
        projectId,
        {
          buffer: file.buffer,
          originalname: file.originalname,
          size: file.size,
        } as ServiceUploadedFile,
        req.ip ?? 'unknown',
      );
    } catch (error) {
      if (
        error instanceof DocumentUploadError ||
        error instanceof ProjectReadOnlyError
      ) {
        throw new HttpException(error.message, error.httpStatus);
      }
      throw error;
    }
  }
}
