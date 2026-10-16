import { createAuthClient } from 'better-auth/react';

const TOKEN_STORAGE_KEY = 'bearer_token';

function readStoredToken(): string {
  if (typeof window === 'undefined') {
    return '';
  }
  return window.localStorage.getItem(TOKEN_STORAGE_KEY) ?? '';
}

/** Token Bearer actual para llamadas directas al API (GraphQL/REST). */
export function getStoredToken(): string {
  return readStoredToken();
}

function storeToken(token: string | null): void {
  if (typeof window === 'undefined' || !token) {
    return;
  }
  window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function clearStoredToken(): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
}

/**
 * Cliente de autenticacion contra el backend (BetterAuth).
 * Las peticiones van al MISMO origen (`/api/auth/*`) y Next las hace proxy
 * hacia el backend con `rewrites()` (ver next.config.ts). Asi el navegador
 * nunca hace cross-origin: no hay preflights CORS que puedan fallar.
 * Usa Bearer tokens guardados en localStorage en lugar de cookies:
 * al crear una sesion el backend devuelve el token (en el body
 * `session.token` y, segun el plugin `bearer`, tambien en el header
 * `set-auth-token`) y aqui se persiste y reenvia
 * en `Authorization: Bearer <token>` en cada peticion.
 *
 * NEXT_PUBLIC_API_URL solo se usa si se quiere apuntar directo al backend
 * (p. ej. app movil); vacio = mismo origen via proxy.
 */
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_API_URL || undefined,
  fetchOptions: {
    auth: {
      type: 'Bearer',
      token: readStoredToken,
    },
    // Fuente del token: header `set-auth-token` y, como respaldo, el body
    // `session.token` (el proxy de Next puede no reenviar el header).
    // Sin este respaldo el localStorage quedaba con un token obsoleto y
    // GraphQL respondia UNAUTHENTICATED aunque la sesion existiera.
    onSuccess: (ctx) => {
      const fromHeader = ctx.response.headers.get('set-auth-token');
      const body = ctx.data as { session?: { token?: unknown } } | null;
      const fromBody =
        typeof body?.session?.token === 'string'
          ? body.session.token
          : null;
      storeToken(fromHeader ?? fromBody ?? null);
    },
  },
});

export const { signIn, signUp, signOut, useSession } = authClient;
