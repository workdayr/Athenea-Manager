'use client';

import { useState, type ReactNode } from 'react';
import { ErrorState } from '@/components/ui/error-state';
import { SessionLoading, useSessionUser } from '@/lib/use-session';
import type { DashboardUser } from '@/lib/dashboard';
import { AppShell } from './app-shell';

/**
 * Marco común de las pantallas internas.
 *
 * Antes cada módulo repetía la consulta de sesión, su propia pantalla de carga
 * y no compartía la navegación lateral. Ahora todas las pantallas autenticadas
 * viven dentro del mismo shell y reciben el usuario ya resuelto.
 */
export function AuthedShell({
  activeId,
  searchPlaceholder,
  children,
  searchQuery,
  onSearchChange,
}: {
  activeId: string;
  searchPlaceholder: string;
  children: (user: DashboardUser) => ReactNode;
  /** Opcional: reemplaza el estado interno del buscador del shell. */
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}) {
  const { user, checking, failed, retry, signOut } = useSessionUser();
  const [internalQuery, setInternalQuery] = useState('');
  const query = searchQuery ?? internalQuery;
  const setQuery = onSearchChange ?? setInternalQuery;

  if (failed) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-surface px-4">
        <ErrorState
          className="w-full max-w-md bg-white"
          title="No pudimos verificar tu sesión"
          description="La conexión con el servidor falló. Tu sesión sigue activa: inténtalo de nuevo."
          onRetry={retry}
        />
      </main>
    );
  }

  if (checking || !user) {
    return <SessionLoading />;
  }

  return (
    <AppShell
      user={user}
      activeId={activeId}
      searchQuery={query}
      searchPlaceholder={searchPlaceholder}
      onSearchChange={setQuery}
      onSignOut={signOut}
    >
      {children(user)}
    </AppShell>
  );
}
