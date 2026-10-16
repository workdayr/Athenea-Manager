import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { prisma } from '../db/prisma.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

/**
 * Guarda de sesion Bearer (RF-001). Valida el token contra la tabla
 * `session` de BetterAuth (plugin `bearer`) y adjunta el usuario.
 * Sirve para REST y GraphQL.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = this.getRequest(context);
    const token = extractBearerToken(
      request.headers?.['authorization'] as unknown,
    );
    if (!token) {
      throw new UnauthorizedException('Falta el token de sesion.');
    }
    const session = await prisma.session.findUnique({
      where: { token },
      include: { user: true },
    });
    if (!session || session.expiresAt <= new Date()) {
      throw new UnauthorizedException('Sesion invalida o expirada.');
    }
    (request as Record<string, unknown>)['user'] = {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role,
    } satisfies AuthenticatedUser;
    return true;
  }

  private getRequest(context: ExecutionContext): {
    headers?: Record<string, unknown>;
  } {
    if (context.getType<string>() === 'graphql') {
      return GqlExecutionContext.create(context).getContext().req;
    }
    return context.switchToHttp().getRequest();
  }
}

function extractBearerToken(header: unknown): string | null {
  if (typeof header !== 'string') {
    return null;
  }
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return null;
  }
  return token;
}
