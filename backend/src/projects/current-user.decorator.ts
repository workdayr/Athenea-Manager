import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import type { AuthenticatedUser } from './session.guard.js';

/**
 * Extrae el usuario fijado por `SessionGuard`. Funciona en REST y GraphQL.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    if (context.getType<string>() === 'graphql') {
      return GqlExecutionContext.create(context).getContext().req.user;
    }
    return context.switchToHttp().getRequest().user;
  },
);
