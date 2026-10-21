'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AdminDashboard } from '@/components/dashboard/admin-dashboard';
import { AppShell } from '@/components/dashboard/app-shell';
import { Icon } from '@/components/dashboard/icons';
import { ProjectDashboard } from '@/components/dashboard/project-dashboard';
import { authClient, clearStoredToken } from '@/lib/auth-client';
import {
  isInstitutionalRole,
  toPlatformRole,
  type DashboardUser,
} from '@/lib/dashboard';

/**
 * Punto de entrada posterior al login (UC-009 / RF-008).
 *
 * El shell y el contenido se eligen segun el rol de plataforma (RF-001):
 * - Administración, coordinación y comité -> tablero institucional.
 * - Investigador Principal y estudiantes -> panel de su proyecto.
 */
export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<DashboardUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let active = true;
    authClient
      .getSession()
      .then(({ data }) => {
        if (!active) {
          return;
        }
        if (!data?.user) {
          router.replace('/login');
          return;
        }
        setUser({
          name: data.user.name,
          email: data.user.email,
          role: toPlatformRole((data.user as { role?: unknown }).role),
        });
        setChecking(false);
      })
      .catch(() => {
        // Sin backend disponible no hay sesion verificable: se vuelve al
        // login en lugar de dejar el panel en estado de carga infinito.
        if (active) {
          router.replace('/login');
        }
      });
    return () => {
      active = false;
    };
  }, [router]);

  async function handleSignOut() {
    // Limpiar el Bearer aunque el signOut falle: sin esto queda un token
    // cadaver en localStorage y GraphQL responde UNAUTHENTICATED aunque
    // BetterAuth ya haya revocado la sesion.
    try {
      await authClient.signOut();
    } finally {
      clearStoredToken();
    }
    router.replace('/login');
  }

  if (checking || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-surface">
        <div className="flex flex-col items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-brand-800 to-brand-500 text-white shadow-sm">
            <Icon name="athenea" className="h-6 w-6" />
          </span>
          <p className="text-sm text-muted">Verificando sesión…</p>
        </div>
      </main>
    );
  }

  const institutional = isInstitutionalRole(user.role);

  return (
    <AppShell
      user={user}
      activeId="panel"
      searchQuery={query}
      searchPlaceholder={
        institutional
          ? 'Búsqueda global FTS: proyectos, protocolos, comités...'
          : 'Buscar en tareas, documentos y evidencias...'
      }
      onSearchChange={setQuery}
      onSignOut={handleSignOut}
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
