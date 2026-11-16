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

const INSTITUTIONAL_DOMAIN = '@unipolidgo.edu.mx';

interface Errors {
  name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

export function RegisterForm({
  initialOAuthError,
}: {
  /**
   * Valor de ?error= que el Server Component (page.tsx) leyo en el
   * servidor y pasa por props. Derivar de aqui (en vez de leer
   * window.location en el render) mantiene el HTML del servidor y el
   * primer render del cliente identicos: sin hydration mismatch
   * (mismo patron que en login).
   */
  initialOAuthError: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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

  const passwordsMatch =
    confirmPassword.length > 0 && password === confirmPassword;

  function validate(): Errors {
    const next: Errors = {};
    if (name.trim().length === 0) {
      next.name = 'Ingresa tu nombre completo.';
    }
    if (!email.trim()) {
      next.email = 'Ingresa tu correo institucional.';
    } else if (!email.trim().toLowerCase().endsWith(INSTITUTIONAL_DOMAIN)) {
      next.email = `Solo se aceptan correos ${INSTITUTIONAL_DOMAIN}.`;
    }
    if (password.length < 8 || password.length > 64) {
      next.password = 'La contraseña debe tener entre 8 y 64 caracteres.';
    }
    if (!confirmPassword) {
      next.confirmPassword = 'Confirma tu contraseña.';
    } else if (password !== confirmPassword) {
      next.confirmPassword = 'Las contraseñas no coinciden.';
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
    const { error: signUpError } = await authClient.signUp.email({
      name: name.trim(),
      email: email.trim(),
      password,
    });
    if (signUpError) {
      setLoading(false);
      setFormError(
        mapAuthError(
          signUpError,
          'No fue posible crear la cuenta. Intenta de nuevo.',
        ),
      );
      return;
    }
    // F1-06 / RF-010: si la verificacion de correo es obligatoria el alta
    // no crea sesion; en ese caso se lleva al usuario a /verify-email.
    const { data: sessionData } = await authClient.getSession();
    setLoading(false);
    if (!sessionData?.user) {
      toast.info(
        'Revisa tu correo institucional y confirma tu cuenta para iniciar sesión.',
        'Cuenta creada',
      );
      router.push(
        `/verify-email?email=${encodeURIComponent(email.trim())}`,
      );
      return;
    }
    toast.success('Cuenta creada. Redirigiendo al panel…');
    router.push('/dashboard');
  }

  async function handleGoogleSignUp() {
    setDismissed(true);
    setFormError(null);
    setGoogleLoading(true);
    // RF-015: registro (o login, si el email ya existe) con Google
    // Workspace. El alta por OAuth aplica la misma politica de dominios
    // en el backend (databaseHooks); un dominio no autorizado redirige
    // aqui con ?error=unauthorized_email_domain.
    const { error: socialError } = await authClient.signIn.social({
      provider: 'google',
      callbackURL: `${frontendOrigin()}/dashboard`,
      errorCallbackURL: `${frontendOrigin()}/register`,
    });
    setGoogleLoading(false);
    if (socialError) {
      setFormError(
        mapAuthError(
          socialError,
          'El registro con Google no está disponible por el momento. Usa el formulario.',
        ),
      );
    }
    // Sin error el cliente redirige solo a Google.
  }

  return (
    <AuthCard
      title="Crear cuenta"
      description="Regístrate con tu correo institucional de la Universidad Politécnica de Durango."
      footer={
        <p>
          ¿Ya tienes cuenta?{' '}
          <Link href="/login" className={authLinkClass}>
            Inicia sesión
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Input
          id="name"
          label="Nombre completo"
          type="text"
          autoComplete="name"
          required
          maxLength={150}
          placeholder="Nombre Apellido"
          value={name}
          error={errors.name}
          onChange={(event) => {
            setName(event.target.value);
            setErrors((current) => ({ ...current, name: undefined }));
          }}
        />

        <Input
          id="email"
          label="Correo institucional"
          type="email"
          autoComplete="email"
          required
          placeholder={`usuario${INSTITUTIONAL_DOMAIN}`}
          hint={`Debe terminar en ${INSTITUTIONAL_DOMAIN}`}
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
            autoComplete="new-password"
            value={password}
            error={errors.password}
            showStrength
            onChange={(value) => {
              setPassword(value);
              setErrors((current) => ({ ...current, password: undefined }));
            }}
            hint="Entre 8 y 64 caracteres."
          />
        </div>

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
          {loading ? 'Creando cuenta…' : 'Crear cuenta'}
        </Button>
      </form>

      <AuthDivider>o regístrate con</AuthDivider>

      <GoogleButton
        onClick={() => void handleGoogleSignUp()}
        loading={googleLoading}
        label={
          googleLoading ? 'Conectando con Google…' : 'Google institucional'
        }
      />
    </AuthCard>
  );
}
