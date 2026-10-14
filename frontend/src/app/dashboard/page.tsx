'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { authClient, clearStoredToken } from '@/lib/auth-client';

interface SessionUser {
  name: string;
  email: string;
  role?: string;
}

/**
 * Vista temporal post-login para verificar el flujo de sesion.
 * Se reemplazara por los dashboards por rol en tareas posteriores.
 */
export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;
    authClient.getSession().then(({ data }) => {
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
        role: (data.user as SessionUser).role,
      });
      setChecking(false);
    });
    return () => {
      active = false;
    };
  }, [router]);

  async function handleSignOut() {
    await authClient.signOut();
    clearStoredToken();
    router.replace('/login');
  }

  if (checking && !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-600">Verificando sesión…</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <section className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <p className="text-sm text-gray-600">Sesión iniciada como</p>
        <h1 className="mt-1 text-2xl font-semibold text-gray-900">
          {user?.name}
        </h1>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-gray-600">Correo</dt>
            <dd className="font-medium text-gray-900">{user?.email}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-gray-600">Rol</dt>
            <dd className="font-medium text-gray-900">{user?.role ?? '—'}</dd>
          </div>
        </dl>
        <button
          type="button"
          onClick={handleSignOut}
          className="mt-6 w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cerrar sesión
        </button>
      </section>
    </main>
  );
}
