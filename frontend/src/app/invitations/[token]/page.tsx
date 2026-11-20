'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { AuthCard, authLinkClass } from '@/components/auth/auth-shell';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { useToast } from '@/components/ui/toast-provider';
import { acceptInvitation, teamErrorMessage } from '@/lib/teams';
import { SessionLoading, useSessionUser } from '@/lib/use-session';

/**
 * Aceptacion de una invitacion por token.
 * El backend verifica que el correo de la sesion coincida con el invitado.
 */
export default function InvitationPage() {
  const params = useParams<{ token: string }>();
  const toast = useToast();
  const { user, checking, failed, retry } = useSessionUser();
  const token = params?.token ?? '';
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState<{
    projectId: number;
    projectTitle: string;
  } | null>(null);

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

  if (failed) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-surface px-4">
        <ErrorState
          className="w-full max-w-md bg-white"
          title="No pudimos verificar tu sesión"
          description="La conexión con el servidor falló. La invitación sigue disponible: inténtalo de nuevo."
          onRetry={retry}
        />
      </main>
    );
  }

  if (checking || !user) {
    return <SessionLoading label="Verificando invitación…" />;
  }

  return (
    <AuthCard
      title="Invitación a un proyecto"
      description="Has recibido una invitación para colaborar en un proyecto de investigación."
      footer={
        <Link href="/dashboard" className={authLinkClass}>
          Volver al panel
        </Link>
      }
    >
      {!accepted ? (
        <div className="space-y-4">
          <p className="text-[13px] leading-relaxed text-muted">
            Se validará que la invitación corresponda al correo{' '}
            <strong className="font-medium text-ink">{user.email}</strong>. Si
            iniciaste sesión con otra cuenta, cierra sesión y vuelve a abrir
            este enlace.
          </p>

          {!token && (
            <Alert tone="danger" title="Enlace incompleto">
              El enlace no contiene un token válido. Pide al administrador del
              proyecto que te envíe una invitación nueva.
            </Alert>
          )}

          {error && (
            <Alert tone="danger" title="No pudimos aceptar la invitación">
              {error}
            </Alert>
          )}

          <Button
            fullWidth
            loading={accepting}
            disabled={token.length === 0}
            onClick={() => void handleAccept()}
          >
            {accepting ? 'Aceptando invitación…' : 'Aceptar invitación'}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <Alert tone="success" title="Invitación aceptada">
            Ya formas parte del proyecto{' '}
            <strong className="font-semibold">{accepted.projectTitle}</strong>.
          </Alert>
          <Link
            href={`/projects/${accepted.projectId}`}
            className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white transition-colors duration-150 hover:bg-brand-800"
          >
            Ir al proyecto
          </Link>
        </div>
      )}
    </AuthCard>
  );
}
