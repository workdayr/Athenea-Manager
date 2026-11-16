'use client';

import { useState } from 'react';
import { AdminDashboard } from '@/components/dashboard/admin-dashboard';
import { AppShell } from '@/components/dashboard/app-shell';
import { ProjectDashboard } from '@/components/dashboard/project-dashboard';
import { ErrorState } from '@/components/ui/error-state';
import { isInstitutionalRole } from '@/lib/dashboard';
import { SessionLoading, useSessionUser } from '@/lib/use-session';

/**
 * Punto de entrada posterior al login (UC-009 / RF-008).
 *
 * El shell y el contenido se eligen segun el rol de plataforma (RF-001):
 * - Administración, coordinación y comité -> tablero institucional.
 * - Investigador Principal y estudiantes -> panel de su proyecto.
 */
export default function DashboardPage() {
  const { user, checking, failed, retry, signOut } = useSessionUser();
  const [query, setQuery] = useState('');

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

  const institutional = isInstitutionalRole(user.role);

  return (
    <AppShell
      user={user}
      activeId="panel"
      searchQuery={query}
      searchPlaceholder={
        institutional
          ? 'Buscar por proyecto, investigador o convocatoria...'
          : 'Buscar en tareas, documentos y evidencias...'
      }
      onSearchChange={setQuery}
      onSignOut={signOut}
    >
      {institutional ? (
        <AdminDashboard
          user={user}
          query={query}
          onSearchChange={setQuery}
        />
      ) : (
        <ProjectDashboard user={user} query={query} />
      )}
    </AppShell>
  );
}
