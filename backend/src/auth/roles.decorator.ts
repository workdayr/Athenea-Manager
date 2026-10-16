// backend/src/auth/roles.decorator.ts

import { SetMetadata } from '@nestjs/common';
import type { AppRole } from './roles.constants.js';

/** Clave de metadata que lee `RolesGuard`. */
export const ROLES_METADATA_KEY = 'athenea:roles';

/**
 * Declara los roles autorizados para una operacion GraphQL.
 *
 * Uso:
 *   @UseGuards(SessionGuard, RolesGuard)
 *   @Roles(ROLES.ADMINISTRATOR)
 *   @Mutation(() => CallGql)
 *   async createCall(...) {}
 *
 * Si la operacion no lleva `@Roles()`, el `RolesGuard` la deja pasar
 * (solo se exige autenticacion via `SessionGuard`).
 */
export const Roles = (...roles: AppRole[]) =>
  SetMetadata(ROLES_METADATA_KEY, roles);