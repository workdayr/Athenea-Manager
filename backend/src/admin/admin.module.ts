import { Module } from '@nestjs/common';
import { AdminResolver } from './admin.resolver.js';

/**
 * F1-07 / RF-001: administracion de usuarios y roles de plataforma.
 * Los servicios son funciones puras sobre Prisma (mismo patron que
 * calls/products), por lo que el modulo solo registra el resolutor.
 */
@Module({
  providers: [AdminResolver],
})
export class AdminModule {}
