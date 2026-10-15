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
 * al crear una sesion el backend expone el token en el header
 * `set-auth-token` (plugin `bearer`) y aqui se persiste y reenvia
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
    onSuccess: (ctx) => {
      storeToken(ctx.response.headers.get('set-auth-token'));
    },
  },
});

export const { signIn, signUp, signOut, useSession } = authClient;
