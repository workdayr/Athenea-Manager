'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/toast-provider';
import { authClient } from '@/lib/auth-client';
import { acceptInvitation, teamErrorMessage } from '@/lib/teams';

/**
 * F2-02 / RF-011: aceptacion de una invitacion por token.
 * El backend verifica que el correo de la sesion coincida con el invitado.
 */
export default function InvitationPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const toast = useToast();
  const token = params?.token ?? '';
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState<{
    projectId: number;
    projectTitle: string;
  } | null>(null);

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
        setEmail(data.user.email);
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

  async function handleAccept() {
    setAccepting(true);
    setError(null);
    try {
      const result = await acceptInvitation(token);
      setAccepted(result);
      toast.success(`Te uniste al proyecto "${result.projectTitle}".`);
    } catch (acceptError: unknown) {
      const message = teamErrorMessage(acceptError);
      setError(message);
      toast.error(message);
    } finally {
      setAccepting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-4 py-10">
      <div className="w-full max-w-lg rounded-2xl border border-line bg-white p-7 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-700">
          Athenea Manager · RF-011
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-ink">
          Invitacion a un proyecto
        </h1>

        {checking && (
          <p className="mt-4 text-sm text-muted">Verificando sesion…</p>
        )}

        {!checking && !accepted && (
          <>
            <p className="mt-3 text-sm text-ink">
              Has recibido una invitacion para colaborar en un proyecto de
              investigacion.
            </p>
            <p className="mt-2 text-xs text-muted">
              Se validara que la invitacion corresponda al correo{' '}
              <strong className="text-ink">{email}</strong>. Si iniciaste sesion
              con otra cuenta, cierra sesion y vuelve a abrir este enlace.
            </p>
            {!token && (
              <p className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                El enlace no contiene un token valido.
              </p>
            )}
            {error && (
              <p className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </p>
            )}
            <button
              type="button"
              disabled={accepting || token.length === 0}
              onClick={() => void handleAccept()}
              className="mt-5 w-full rounded-md bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-50"
            >
              {accepting ? 'Aceptando invitacion…' : 'Aceptar invitacion'}
            </button>
          </>
        )}

        {accepted && (
          <div className="mt-5">
            <p className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              Ya formas parte del proyecto{' '}
              <strong>{accepted.projectTitle}</strong>.
            </p>
            <Link
              href={`/projects/${accepted.projectId}`}
              className="mt-4 inline-flex rounded-md bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800"
            >
              Ir al proyecto
            </Link>
          </div>
        )}

        <Link
          href="/dashboard"
          className="mt-5 block text-center text-xs font-medium text-muted hover:text-ink"
        >
          Volver al panel
        </Link>
      </div>
    </main>
  );
}
