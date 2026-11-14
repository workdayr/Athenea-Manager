import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  ParseIntPipe,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { prisma } from '../db/prisma.js';
import { CurrentUser } from '../projects/current-user.decorator.js';
import { SessionGuard, type AuthenticatedUser } from '../projects/session.guard.js';
import {
  generateDownloadToken,
  verifyDownloadToken,
} from './document-token.service.js';
import { isInstitutionalRole } from './documents.policy.js';

interface RequestWithIp {
  ip?: string;
  headers?: Record<string, string | string[] | undefined>;
}

@Controller('documents')
export class DocumentsDownloadController {
  /**
   * F1-05: Solicitar URL firmada de descarga (requiere sesión Bearer).
   * GET /documents/:id/download
   */
  @Get(':id/download')
  @UseGuards(SessionGuard)
  async getDownloadUrl(
    @Param('id', ParseIntPipe) documentId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const document = await prisma.projectDocument.findUnique({
      where: { document_id: documentId },
      include: {
        project: {
          include: {
            projectUsers: {
              where: { user_id: user.id },
            },
          },
        },
      },
    });

    if (!document) {
      throw new HttpException('El documento no existe.', HttpStatus.NOT_FOUND);
    }

    const isMember = document.project.projectUsers.length > 0;
    const isInstitutional = isInstitutionalRole(user.role);

    // Si es miembro del equipo: acceso total.
    // Si no es miembro pero es rol institucional: solo si es Shared_with_administration.
    if (!isMember) {
      if (!isInstitutional) {
        throw new HttpException(
          'No tienes permiso para descargar este documento.',
          HttpStatus.FORBIDDEN,
        );
      }
      if (document.visibility !== 'Shared_with_administration') {
        throw new HttpException(
          'Este documento está restringido al equipo del proyecto.',
          HttpStatus.FORBIDDEN,
        );
      }
    }

    const { token, expiresAt } = generateDownloadToken(documentId, user.id);
    const downloadUrl = `/api/documents/${documentId}/file?token=${encodeURIComponent(token)}`;

    return {
      documentId,
      url: downloadUrl,
      expiresAt: expiresAt.toISOString(),
    };
  }

  /**
   * F1-05: Stream del archivo protegido mediante token HMAC.
   * GET /documents/:id/file?token=...
   */
  @Get(':id/file')
  async streamFile(
    @Param('id', ParseIntPipe) documentId: number,
    @Query('token') token: string,
    @Res() res: Response,
  ) {
    if (!token) {
      throw new HttpException('Falta el token de descarga.', HttpStatus.UNAUTHORIZED);
    }

    const verification = verifyDownloadToken(token, documentId);
    if (!verification.valid) {
      if (verification.expired) {
        throw new HttpException(
          verification.reason ?? 'El token ha expirado.',
          HttpStatus.GONE, // 410 Gone según el plan
        );
      }
      throw new HttpException(
        verification.reason ?? 'Token de descarga inválido.',
        HttpStatus.FORBIDDEN,
      );
    }

    const document = await prisma.projectDocument.findUnique({
      where: { document_id: documentId },
    });

    if (!document) {
      throw new HttpException('El documento no existe.', HttpStatus.NOT_FOUND);
    }

    const filePath = resolve(document.file_url);
    if (!existsSync(filePath)) {
      throw new HttpException(
        'El archivo fisico no se encuentra disponible.',
        HttpStatus.NOT_FOUND,
      );
    }

    const stat = statSync(filePath);
    const fileName = document.file_name ?? `document_${documentId}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', stat.size);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(fileName)}"`,
    );

    const stream = createReadStream(filePath);
    stream.pipe(res);
  }
}
