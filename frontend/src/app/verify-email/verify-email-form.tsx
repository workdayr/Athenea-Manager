'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { AuthCard, authLinkClass } from '@/components/auth/auth-shell';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast-provider';
import { authClient } from '@/lib/auth-client';
import { mapAuthError } from '@/lib/auth-errors';
import { verificationConfirmationHref } from '@/lib/verify-email';

/**
 * Confirma el correo con el token del enlace y permite
 * reenviar la verificacion. La confirmacion es un enlace top-level (no un
 * fetch) porque BetterAuth responde con redireccion.
 */
export function VerifyEmailForm({
  token,
  initialEmail,
  verified,
  error,
}: {
  token: string | null;
  initialEmail: string;
  verified: boolean;
  /** Codigo devuelto por BetterAuth cuando el enlace no es valido. */
  error: string | null;
}) {
  const toast = useToast();
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [resent, setResent] = useState(false);

  async function handleResend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const value = email.trim();
    if (!value) {
      setFieldError('Ingresa tu correo institucional.');
      document.getElementById('email')?.focus();
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setFieldError('Escribe un correo electrónico válido.');
      document.getElementById('email')?.focus();
      return;
    }
    setLoading(true);
    const { error: resendError } = await authClient.sendVerificationEmail({
      email: value,
      callbackURL: `${window.location.origin}/verify-email`,
    });
    setLoading(false);
    if (resendError) {
      setFormError(
        mapAuthError(
          resendError,
          'No fue posible reenviar el correo de verificación. Intenta de nuevo.',
        ),
      );
      return;
    }
    setResent(true);
    toast.success(
      'Si la cuenta existe y no está verificada, recibirás un nuevo enlace.',
    );
  }

  function handleConfirm() {
    if (!token) {
      return;
    }
    setConfirming(true);
    window.location.assign(verificationConfirmationHref(token));
  }

  return (
    <AuthCard
      title="Verificación de correo"
      description={
        verified
          ? undefined
          : token
            ? 'Confirma que este es tu correo institucional para activar tu cuenta.'
            : 'Abre el enlace que enviamos a tu correo institucional. Si no lo recibiste o expiró, solicita uno nuevo.'
      }
      footer={
        <p>
          <Link href="/login" className={authLinkClass}>
            Volver a iniciar sesión
          </Link>
        </p>
      }
    >
      {verified ? (
        <div className="space-y-4">
          <Alert tone="success" title="Correo verificado">
            Ya puedes iniciar sesión con tu cuenta institucional.
          </Alert>
          <Button
            fullWidth
            onClick={() => {
              router.push('/login');
            }}
          >
            Ir a iniciar sesión
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {error && (
            <Alert tone="danger" title="No pudimos verificar el enlace">
              {error === 'TOKEN_EXPIRED'
                ? 'El enlace de verificación expiró. Solicita uno nuevo abajo.'
                : 'El enlace de verificación no es válido. Solicita uno nuevo abajo.'}
            </Alert>
          )}

          {token && (
            <Button fullWidth loading={confirming} onClick={handleConfirm}>
              {confirming ? 'Verificando…' : 'Confirmar mi correo'}
            </Button>
          )}

          <form
            onSubmit={handleResend}
            className={
              token
                ? 'space-y-3 border-t border-line pt-4'
                : 'space-y-3'
            }
            noValidate
          >
            {token && (
              <p className="text-[13px] font-medium text-ink">
                Reenviar enlace de verificación
              </p>
            )}
            <Input
              id="email"
              label="Correo institucional"
              type="email"
              autoComplete="email"
              required
              placeholder="usuario@unipolidgo.edu.mx"
              value={email}
              error={fieldError}
              onChange={(event) => {
                setEmail(event.target.value);
                setFieldError(undefined);
              }}
            />

            {formError && <Alert tone="danger">{formError}</Alert>}

            <Button
              type="submit"
              fullWidth
              variant={token ? 'secondary' : 'primary'}
              loading={loading}
            >
              {loading
                ? 'Enviando…'
                : resent
                  ? 'Reenviar de nuevo'
                  : 'Reenviar correo'}
            </Button>
          </form>
        </div>
      )}
    </AuthCard>
  );
}
