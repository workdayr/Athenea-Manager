import { Controller, Post, Param, ParseIntPipe, UseGuards, UseInterceptors, UploadedFile, Req, HttpException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { SessionGuard, type AuthenticatedUser } from '../projects/session.guard.js';
import { CurrentUser } from '../projects/current-user.decorator.js';
import { MilestonesService } from './milestones.service.js';
import { MAX_FILE_BYTES } from '../projects/projects.constants.js';

@Controller('milestones')
@UseGuards(SessionGuard)
export class MilestonesController {
  constructor(private readonly milestonesService: MilestonesService) {}

  @Post(':id/evidence')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_FILE_BYTES } }))
  async uploadEvidence(
    @Param('id', ParseIntPipe) milestoneId: number,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: any,
  ) {
    if (!file) throw new HttpException('Adjunta un archivo.', 400);
    try {
      return await this.milestonesService.uploadEvidenceAndComplete(
        user, milestoneId, 
        { buffer: file.buffer, originalname: file.originalname, size: file.size }, 
        req.ip ?? 'unknown'
      );
    } catch (e: any) {
      const status =
        typeof e?.httpStatus === 'number'
          ? e.httpStatus
          : e.extensions?.code === 'FORBIDDEN'
            ? 403
            : 400;
      throw new HttpException(e.message, status);
    }
  }
}