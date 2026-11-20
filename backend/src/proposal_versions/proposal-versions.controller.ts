import {
  Body,
  Controller,
  HttpException,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ROLES } from '../auth/roles.constants.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { CurrentUser } from '../projects/current-user.decorator.js';
import { MAX_FILE_BYTES } from '../projects/projects.constants.js';
import { ProjectReadOnlyError } from '../projects/project-write-guard.js';
import {
  SessionGuard,
  type AuthenticatedUser,
} from '../projects/session.guard.js';
import {
  ProposalVersionError,
  uploadRevisedProposal,
} from './proposal-versions.service.js';

interface RequestWithIp {
  ip?: string;
  headers?: Record<string, string | string[] | undefined>;
}

@Controller('projects')
@UseGuards(SessionGuard, RolesGuard)
export class ProposalVersionsController {
  @Post(':id/proposal-versions')
  @Roles(ROLES.PRINCIPAL_INVESTIGATOR)
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_BYTES },
    }),
  )
  async upload(
    @Param('id', ParseIntPipe) projectId: number,
    @Body('comment') comment: string | undefined,
    @Body('docTypes') docTypes: string | string[] | undefined,
    @UploadedFiles() files: Express.Multer.File[] | undefined,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: RequestWithIp,
  ) {
    try {
      if (!files || files.length === 0) {
        throw new ProposalVersionError(
          'VALIDATION_ERROR',
          'Adjunta al menos un archivo PDF.',
          400,
          'files',
        );
      }

      // Normalizar docTypes
      let typesArray: string[] = [];
      if (Array.isArray(docTypes)) {
        typesArray = docTypes;
      } else if (typeof docTypes === 'string') {
        try {
          const parsed = JSON.parse(docTypes);
          if (Array.isArray(parsed)) typesArray = parsed;
          else typesArray = [docTypes];
        } catch {
          typesArray = [docTypes];
        }
      }

      const preparedFiles = files.map((file, idx) => ({
        docType: typesArray[idx] ?? '',
        buffer: file.buffer,
        originalname: file.originalname,
        size: file.size,
      }));

      const forwarded = req.headers?.['x-forwarded-for'];
      const clientIp = Array.isArray(forwarded)
        ? forwarded[0]
        : (forwarded as string)?.split(',')[0]?.trim() || req.ip || 'unknown';

      return await uploadRevisedProposal(
        user,
        {
          projectId,
          comment,
          files: preparedFiles,
        },
        clientIp,
      );
    } catch (error) {
      if (
        error instanceof ProposalVersionError ||
        error instanceof ProjectReadOnlyError
      ) {
        throw new HttpException(error.message, error.httpStatus);
      }
      throw error;
    }
  }
}
