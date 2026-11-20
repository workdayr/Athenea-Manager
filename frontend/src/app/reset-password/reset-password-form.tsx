'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import {
  AuthCard,
  PasswordField,
  authLinkClass,
} from '@/components/auth/auth-shell';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast-provider';
import { authClient } from '@/lib/auth-client';
import { mapAuthError } from '@/lib/auth-errors';

interface Errors {
  password?: string;
  confirmPassword?: string;
}

/**
 * Fija la nueva contrasena con el token de un solo uso.
 * El backend hace cumplir la vigencia de 30 minutos.
 */
export function ResetPasswordForm({
  token,
  initialError,
}: {
  token: string | null;
  initialError: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const invalidLink = !token || initialError === 'INVALID_TOKEN';
  const passwordsMatch =
    confirmPassword.length > 0 && password === confirmPassword;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const next: Errors = {};
    if (password.length < 8 || password.length > 64) {
      next.password = 'La contraseña debe tener entre 8 y 64 caracteres.';
    }
    if (!confirmPassword) {
      next.confirmPassword = 'Confirma tu contraseña.';
    } else if (password !== confirmPassword) {
      next.confirmPassword = 'Las contraseñas no coinciden.';
    }
    setErrors(next);
    const first = Object.keys(next)[0];
    if (first) {
      document.getElementById(first)?.focus();
      return;
    }
    setLoading(true);
    const { error } = await authClient.resetPassword({
      newPassword: password,
      token: token as string,
    });
    setLoading(false);
    if (error) {
      setFormError(
        mapAuthError(
          error,
          'El enlace es inválido o expiró. Solicita uno nuevo.',
        ),
      );
      return;
    }
    setDone(true);
    toast.success('Contraseña actualizada. Ya puedes iniciar sesión.');
  }

  return (
    <AuthCard
      title="Nueva contraseña"
      description={
        invalidLink || done
          ? undefined
          : 'Elige una contraseña de 8 a 64 caracteres para tu cuenta institucional.'
      }
      footer={
        !done ? (
          <p>
            <Link href="/login" className={authLinkClass}>
              Volver a iniciar sesión
            </Link>
          </p>
        ) : undefined
      }
    >
      {invalidLink ? (
        <div className="space-y-4">
          <Alert tone="danger" title="Enlace no válido">
            El enlace es inválido o ya expiró. Solicita uno nuevo para
            continuar.
          </Alert>
          <Button fullWidth onClick={() => router.push('/forgot-password')}>
            Solicitar nuevo enlace
          </Button>
        </div>
      ) : done ? (
        <div className="space-y-4">
          <Alert tone="success" title="Contraseña actualizada">
            Por seguridad se cerraron las sesiones abiertas en otros
            dispositivos.
          </Alert>
          <Button fullWidth onClick={() => router.push('/login')}>
            Ir a iniciar sesión
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <PasswordField
            id="password"
            label="Nueva contraseña"
            autoComplete="new-password"
            value={password}
            error={errors.password}
            showStrength
            onChange={(value) => {
              setPassword(value);
              setErrors((current) => ({ ...current, password: undefined }));
            }}
          />

          <div>
            <PasswordField
              id="confirmPassword"
              label="Confirmar contraseña"
              autoComplete="new-password"
              value={confirmPassword}
              error={errors.confirmPassword}
              onChange={(value) => {
                setConfirmPassword(value);
                setErrors((current) => ({
                  ...current,
                  confirmPassword: undefined,
                }));
              }}
            />
            {passwordsMatch && (
              <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-success">
                <span aria-hidden="true">✓</span>
                Las contraseñas coinciden.
              </p>
            )}
          </div>

          {formError && <Alert tone="danger">{formError}</Alert>}

          <Button type="submit" fullWidth loading={loading}>
            {loading ? 'Guardando…' : 'Cambiar contraseña'}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
