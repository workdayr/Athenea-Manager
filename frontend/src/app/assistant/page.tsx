'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/dashboard/app-shell';
import { Icon } from '@/components/dashboard/icons';
import { AssistantChat } from '@/components/assistant/assistant-chat';
import { authClient, clearStoredToken } from '@/lib/auth-client';
import { toPlatformRole, type DashboardUser } from '@/lib/dashboard';

/**
 * US Asistente Virtual RAG (UC-010 / RF-010).
 *
 * Cualquier usuario autenticado puede consultar politicas institucionales
 * en lenguaje natural. La respuesta se limita a fragmentos autorizados y
 * siempre muestra citas enlazadas al documento original (AIR-001..004).
 */
export default function AssistantPage() {
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
          id: data.user.id,
          name: data.user.name,
          email: data.user.email,
          role: toPlatformRole((data.user as { role?: unknown }).role),
        });
        setChecking(false);
      })
      .catch(() => {
        if (active) {
          router.replace('/login');
        }
      });
    return () => {
      active = false;
    };
  }, [router]);

  async function handleSignOut() {
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

  return (
    <AppShell
      user={user}
      activeId="rag"
      searchQuery={query}
      searchPlaceholder="Buscar en tus conversaciones…"
      onSearchChange={setQuery}
      onSignOut={handleSignOut}
    >
      <AssistantChat user={user} searchQuery={query} />
    </AppShell>
  );
}
