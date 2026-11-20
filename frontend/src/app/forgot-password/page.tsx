'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { AuthCard, authLinkClass } from '@/components/auth/auth-shell';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast-provider';
import { authClient } from '@/lib/auth-client';
import { mapAuthError } from '@/lib/auth-errors';

/**
 * Solicitud de recuperacion de contrasena.
 *
 * Por seguridad (anti-enumeracion) el backend responde igual exista o no
 * la cuenta; la pantalla muestra siempre el mismo mensaje de confirmacion.
 */
export default function ForgotPasswordPage() {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const value = email.trim();
    if (!value) {
      setError('Ingresa tu correo institucional.');
      document.getElementById('email')?.focus();
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setError('Escribe un correo electrónico válido.');
      document.getElementById('email')?.focus();
      return;
    }
    setLoading(true);
    const { error: requestError } = await authClient.requestPasswordReset({
      email: value,
    });
    setLoading(false);
    if (requestError) {
      setFormError(
        mapAuthError(
          requestError,
          'No fue posible solicitar el cambio de contraseña. Intenta de nuevo.',
        ),
      );
      return;
    }
    setSent(true);
    toast.success(
      'Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.',
    );
  }

  return (
    <AuthCard
      title="Recuperar contraseña"
      description="Te enviaremos un enlace válido por 30 minutos para elegir una nueva contraseña."
      footer={
        <p>
          <Link href="/login" className={authLinkClass}>
            Volver a iniciar sesión
          </Link>
        </p>
      }
    >
      {sent ? (
        <div className="space-y-4">
          <Alert tone="success" title="Enlace enviado">
            Revisa la bandeja de entrada de <strong>{email.trim()}</strong> y
            sigue el enlace. Si no lo encuentras, revisa la carpeta de spam.
          </Alert>
          <Button variant="secondary" fullWidth onClick={() => setSent(false)}>
            Usar otro correo
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <Input
            id="email"
            label="Correo institucional"
            type="email"
            autoComplete="email"
            required
            placeholder="usuario@unipolidgo.edu.mx"
            value={email}
            error={error}
            onChange={(event) => {
              setEmail(event.target.value);
              setError(undefined);
            }}
          />

          {formError && <Alert tone="danger">{formError}</Alert>}

          <Button type="submit" fullWidth loading={loading}>
            {loading ? 'Enviando…' : 'Enviar enlace de recuperación'}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
