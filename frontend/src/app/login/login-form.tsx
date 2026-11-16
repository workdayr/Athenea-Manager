'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import {
  AuthCard,
  AuthDivider,
  GoogleButton,
  PasswordField,
  authLinkClass,
} from '@/components/auth/auth-shell';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast-provider';
import { authClient, frontendOrigin } from '@/lib/auth-client';
import { mapAuthError, mapOAuthCallbackError } from '@/lib/auth-errors';
import { useGuestOnly } from '@/lib/use-guest-only';

interface Errors {
  email?: string;
  password?: string;
}

export function LoginForm({
  initialOAuthError,
}: {
  /**
   * Valor de ?error= que el Server Component (page.tsx) leyo en el
   * servidor y pasa por props. Derivar de aqui (en vez de leer
   * window.location en el render) mantiene el HTML del servidor y el
   * primer render del cliente identicos: sin hydration mismatch.
   */
  initialOAuthError: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  // Descarta el banner de ?error= cuando el usuario interactua.
  const [dismissed, setDismissed] = useState(false);

  useGuestOnly();

  // Derivado de props (identico en servidor y cliente) + interaccion del
  // usuario. Al no guardarlo en state, las navegaciones client-side que
  // cambien ?error= tambien se reflejan.
  const oauthError = dismissed ? null : initialOAuthError;
  const oauthMessage = mapOAuthCallbackError(oauthError);

  // El callback OAuth redirige aqui con ?error=... cuando algo falla.
  // Solo limpia la URL (sistema externo); el mensaje ya llego por props.
  useEffect(() => {
    if (window.location.search.includes('error=')) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  function validate(): Errors {
    const next: Errors = {};
    const value = email.trim();
    if (!value) {
      next.email = 'Ingresa tu correo institucional.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      next.email = 'Escribe un correo electrónico válido.';
    }
    if (!password) {
      next.password = 'Ingresa tu contraseña.';
    } else if (password.length < 8 || password.length > 64) {
      next.password = 'La contraseña debe tener entre 8 y 64 caracteres.';
    }
    return next;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDismissed(true);
    setFormError(null);
    const next = validate();
    setErrors(next);
    const first = Object.keys(next)[0];
    if (first) {
      document.getElementById(first)?.focus();
      return;
    }
    setLoading(true);
    const { error: signInError } = await authClient.signIn.email({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (signInError) {
      setFormError(
        mapAuthError(
          signInError,
          'No fue posible iniciar sesión. Intenta de nuevo.',
        ),
      );
      return;
    }
    toast.success('Sesión iniciada. Redirigiendo al panel…');
    router.push('/dashboard');
  }

  async function handleGoogleSignIn() {
    setDismissed(true);
    setFormError(null);
    setGoogleLoading(true);
    const { error: socialError } = await authClient.signIn.social({
      provider: 'google',
      callbackURL: `${frontendOrigin()}/dashboard`,
      errorCallbackURL: `${frontendOrigin()}/login`,
    });
    setGoogleLoading(false);
    if (socialError) {
      setFormError(
        mapAuthError(
          socialError,
          'El inicio con Google no está disponible por el momento. Usa tu correo y contraseña.',
        ),
      );
    }
    // Sin error el cliente redirige solo a Google.
  }

  return (
    <AuthCard
      title="Inicia sesión"
      description="Accede con tu correo institucional de la Universidad Politécnica de Durango."
      footer={
        <>
          <p>
            ¿No tienes cuenta?{' '}
            <Link href="/register" className={authLinkClass}>
              Regístrate
            </Link>
          </p>
          <p className="mt-1.5">
            ¿Aún no verificas tu correo?{' '}
            <Link href="/verify-email" className={authLinkClass}>
              Reenviar verificación
            </Link>
          </p>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Input
          id="email"
          label="Correo institucional"
          type="email"
          autoComplete="email"
          required
          placeholder="usuario@unipolidgo.edu.mx"
          value={email}
          error={errors.email}
          onChange={(event) => {
            setEmail(event.target.value);
            setErrors((current) => ({ ...current, email: undefined }));
          }}
        />

        <div>
          <PasswordField
            id="password"
            label="Contraseña"
            autoComplete="current-password"
            value={password}
            error={errors.password}
            onChange={(value) => {
              setPassword(value);
              setErrors((current) => ({ ...current, password: undefined }));
            }}
          />
          <div className="mt-1.5 flex justify-end">
            <Link
              href="/forgot-password"
              className="rounded text-xs font-medium text-brand-700 underline-offset-4 transition-colors duration-150 hover:text-brand-800 hover:underline"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
        </div>

        {(formError || oauthMessage) && (
          <Alert tone="danger">{formError ?? oauthMessage}</Alert>
        )}

        <Button
          type="submit"
          fullWidth
          loading={loading}
          className="mt-1"
          disabled={googleLoading}
        >
          {loading ? 'Ingresando…' : 'Ingresar'}
        </Button>
      </form>

      <AuthDivider>o continúa con</AuthDivider>

      <GoogleButton
        onClick={() => void handleGoogleSignIn()}
        loading={googleLoading}
        label={googleLoading ? 'Conectando con Google…' : 'Google institucional'}
      />
    </AuthCard>
  );
}
