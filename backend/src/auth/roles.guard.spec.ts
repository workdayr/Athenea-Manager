// backend/src/auth/roles.guard.spec.ts

import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { GraphQLError } from 'graphql';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '../projects/session.guard.js';
import { AUTH_ERROR_CODES, ROLES } from './roles.constants.js';
import { RolesGuard } from './roles.guard.js';

/**
 * Construye un ExecutionContext falso que:
 *  - expone `getHandler()` y `getClass()` (los usa el guard para leer metadata)
 *  - hace que `GqlExecutionContext.create(context)` devuelva `req.user`
 *
 * Como el guard solo toca esos tres puntos, no necesitamos NestJS real.
 */
function makeContext(user: AuthenticatedUser | undefined): ExecutionContext {
  const fakeContext = {
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;

  vi.spyOn(GqlExecutionContext, 'create').mockReturnValueOnce({
    getContext: () => ({ req: { user } }),
  } as unknown as ReturnType<typeof GqlExecutionContext.create>);

  return fakeContext;
}

const adminUser: AuthenticatedUser = {
  id: 'u-1',
  email: 'admin@unipolidgo.edu.mx',
  name: 'Admin',
  role: ROLES.ADMINISTRATOR,
};

const piUser: AuthenticatedUser = {
  id: 'u-2',
  email: 'pi@unipolidgo.edu.mx',
  name: 'PI',
  role: ROLES.PRINCIPAL_INVESTIGATOR,
};

/** Ejecuta el guard y captura el error lanzado (o undefined si no hubo). */
function catchError(fn: () => unknown): unknown {
  try {
    fn();
    return undefined;
  } catch (error) {
    return error;
  }
}

describe('RolesGuard (RF-001)', () => {
  let reflector: Reflector;
  let guard: RolesGuard;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('permite el paso si la operacion no declara @Roles()', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const context = makeContext(undefined);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('permite el paso si la lista de roles esta vacia', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue([]);
    const context = makeContext(undefined);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('permite el paso cuando el rol del usuario esta autorizado', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue([
      ROLES.ADMINISTRATOR,
    ]);
    const context = makeContext(adminUser);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('permite el paso si el usuario tiene uno de varios roles permitidos', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue([
      ROLES.ADMINISTRATOR,
      ROLES.COORDINATOR,
    ]);
    const context = makeContext(adminUser);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('lanza FORBIDDEN si el rol del usuario no esta autorizado', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue([
      ROLES.ADMINISTRATOR,
    ]);
    const context = makeContext(piUser);

    const error = catchError(() => guard.canActivate(context));
    expect(error).toBeInstanceOf(GraphQLError);
    expect((error as GraphQLError).extensions.code).toBe(
      AUTH_ERROR_CODES.FORBIDDEN,
    );
  });

  it('lanza UNAUTHENTICATED si no hay usuario en el request', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue([
      ROLES.ADMINISTRATOR,
    ]);
    const context = makeContext(undefined);

    const error = catchError(() => guard.canActivate(context));
    expect(error).toBeInstanceOf(GraphQLError);
    expect((error as GraphQLError).extensions.code).toBe(
      AUTH_ERROR_CODES.UNAUTHENTICATED,
    );
  });
});