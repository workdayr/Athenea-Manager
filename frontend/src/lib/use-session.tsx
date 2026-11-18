'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Spinner } from '@/components/ui/spinner';
import { authClient, clearStoredToken } from '@/lib/auth-client';
import { toPlatformRole, type DashboardUser } from '@/lib/dashboard';

export interface SessionState {
  user: DashboardUser | null;
  /** `true` mientras se consulta la sesión por primera vez. */
  checking: boolean;
  /** `true` si la consulta falló (red/servidor), no si no hay sesión. */
  failed: boolean;
  retry: () => void;
  signOut: () => Promise<void>;
}

/**
 * Única fuente de verdad de la sesión para las pantallas autenticadas.
 *
 * Antes cada página repetía el mismo `getSession()` con su propio estado.
 * Ahora la consulta distingue "sin sesión" (redirige) de "no se pudo
 * verificar" (se ofrece reintentar) en lugar de expulsar al login ante
 * cualquier error de red.
 */
export function useSessionUser({
  redirectTo = '/login',
}: { redirectTo?: string } = {}): SessionState {
  const router = useRouter();
  const [user, setUser] = useState<DashboardUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    authClient
      .getSession()
      .then(({ data }) => {
        if (!active) {
          return;
        }
        if (!data?.user) {
          router.replace(redirectTo);
          return;
        }
        setUser({
          id: data.user.id,
          name: data.user.name,
          email: data.user.email,
          role: toPlatformRole((data.user as { role?: unknown }).role),
        });
        setFailed(false);
        setChecking(false);
      })
      .catch(() => {
        if (!active) {
          return;
        }
        setFailed(true);
        setChecking(false);
      });
    return () => {
      active = false;
    };
  }, [attempt, redirectTo, router]);

  const retry = useCallback(() => {
    setChecking(true);
    setFailed(false);
    setAttempt((current) => current + 1);
  }, []);

  const signOut = useCallback(async () => {
    // Limpiar el Bearer aunque el signOut falle: sin esto queda un token
    // cadaver en localStorage y GraphQL responde UNAUTHENTICATED aunque
    // BetterAuth ya haya revocado la sesion.
    try {
      await authClient.signOut();
    } finally {
      clearStoredToken();
    }
    router.replace('/login');
  }, [router]);

  return { user, checking, failed, retry, signOut };
}

/** Pantalla de verificación de sesión, igual en toda la aplicación. */
export function SessionLoading({ label = 'Verificando sesión…' }: { label?: string }) {
  return (
    <main
      aria-busy="true"
      className="flex min-h-screen flex-col items-center justify-center gap-3 bg-surface"
    >
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-brand-800 to-brand-500 text-white shadow-card">
        <svg
          viewBox="0 0 24 24"
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 3 4.5 6.2v5.4c0 4.4 3.1 8.3 7.5 9.4 4.4-1.1 7.5-5 7.5-9.4V6.2L12 3Z" />
          <path d="m9 12 2.2 2.2L15 10.5" />
        </svg>
      </span>
      <p className="flex items-center gap-2 text-sm text-muted" role="status">
        <Spinner className="h-3.5 w-3.5" />
        {label}
      </p>
    </main>
  );
}
