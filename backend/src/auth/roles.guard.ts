// backend/src/auth/roles.guard.ts

import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { GraphQLError } from 'graphql';
import type { AuthenticatedUser } from '../projects/session.guard.js';
import {
  AUTH_ERROR_CODES,
  type AppRole,
} from './roles.constants.js';
import { ROLES_METADATA_KEY } from './roles.decorator.js';

/**
 * RF-001: valida que el usuario autenticado tenga uno de los roles
 * declarados con `@Roles()` en la operacion GraphQL.
 *
 * Debe ejecutarse DESPUES de `SessionGuard`, que es quien adjunta
 * `req.user`. Uso tipico:
 *
 *   @UseGuards(SessionGuard, RolesGuard)
 *   @Roles(ROLES.ADMINISTRATOR)
 *   @Mutation(() => CallGql)
 *   async createCall() {}
 *
 * Si la operacion no lleva `@Roles()`, el guard la deja pasar: la
 * unica restriccion es estar autenticado (lo que ya impone SessionGuard).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Metodo > clase: si el resolver o el metodo declaran @Roles(),
    // se usa el mas especifico (getAllAndOverride).
    const requiredRoles = this.reflector.getAllAndOverride<AppRole[]>(
      ROLES_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Sin @Roles() no hay restriccion adicional.
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = this.getRequest(context);
    const user = (request as { user?: AuthenticatedUser }).user;

    // Red de seguridad: si SessionGuard no corrio, se rechaza.
    if (!user) {
      throw new GraphQLError('No autenticado.', {
        extensions: { code: AUTH_ERROR_CODES.UNAUTHENTICATED, field: null },
      });
    }

    if (!requiredRoles.includes(user.role as AppRole)) {
      throw new GraphQLError(
        'No tienes permisos para realizar esta accion.',
        {
          extensions: { code: AUTH_ERROR_CODES.FORBIDDEN, field: null },
        },
      );
    }

    return true;
  }

  private getRequest(context: ExecutionContext): unknown {
    return GqlExecutionContext.create(context).getContext().req;
  }
}