'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { authClient } from '@/lib/auth-client';
import { mapAuthError, mapOAuthCallbackError } from '@/lib/auth-errors';

const INSTITUTIONAL_DOMAIN = '@unipolidgo.edu.mx';

function frontendOrigin(): string {
  return window.location.origin;
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
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  // Descarta el banner de ?error= cuando el usuario interactua.
  const [dismissed, setDismissed] = useState(false);

  // Derivado de props (identico en servidor y cliente) + interaccion del
  // usuario. Al no guardarlo en state, las navegaciones client-side que
  // cambien ?error= tambien se reflejan.
  const oauthError = dismissed ? null : initialOAuthError;
  const displayError = error ?? mapOAuthCallbackError(oauthError);

  // El callback OAuth redirige aqui con ?error=... cuando algo falla.
  // Solo limpia la URL (sistema externo); el mensaje ya llego por props.
  useEffect(() => {
    if (window.location.search.includes('error=')) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setDismissed(true);
    if (name.trim().length === 0) {
      setError('Ingresa tu nombre completo.');
      return;
    }
    if (!email.trim().toLowerCase().endsWith(INSTITUTIONAL_DOMAIN)) {
      setError(
        `Solo se aceptan correos institucionales ${INSTITUTIONAL_DOMAIN}.`,
      );
      return;
    }
    if (password.length < 8 || password.length > 64) {
      setError('La contraseña debe tener entre 8 y 64 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setLoading(true);
    const { error: signUpError } = await authClient.signUp.email({
      name: name.trim(),
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (signUpError) {
      setError(
        mapAuthError(
          signUpError,
          'No fue posible crear la cuenta. Intenta de nuevo.',
        ),
      );
      return;
    }
    router.push('/dashboard');
  }

  async function handleGoogleSignUp() {
    setError(null);
    setDismissed(true);
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
      setError(
        mapAuthError(
          socialError,
          'El registro con Google no está disponible por el momento. Usa el formulario.',
        ),
      );
    }
    // Sin error el cliente redirige solo a Google.
  }

  const inputClassName =
    'w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:border-blue-600 focus:outline-none';

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10">
      <section className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-gray-900">Crear cuenta</h1>
        <p className="mt-1 text-sm text-gray-600">
          Regístrate con tu correo institucional de la Universidad Politécnica
          de Durango.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
          <div>
            <label
              htmlFor="name"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Nombre completo
            </label>
            <input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              required
              maxLength={150}
              placeholder="Nombre Apellido"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={inputClassName}
            />
          </div>

          <div>
            <label
              htmlFor="email"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Correo institucional
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="usuario@unipolidgo.edu.mx"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={inputClassName}
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Contraseña (8 a 64 caracteres)
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={64}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={inputClassName}
            />
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Confirmar contraseña
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={64}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className={inputClassName}
            />
          </div>

          {displayError && (
            <p
              role="alert"
              className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {displayError}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || googleLoading}
            className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Creando cuenta…' : 'Crear cuenta'}
          </button>
        </form>

        <div className="mt-4">
          <button
            type="button"
            disabled={loading || googleLoading}
            onClick={handleGoogleSignUp}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {googleLoading
              ? 'Conectando con Google…'
              : 'Crear cuenta con Google institucional'}
          </button>
        </div>

        <p className="mt-6 text-center text-sm text-gray-600">
          ¿Ya tienes cuenta?{' '}
          <Link href="/login" className="font-medium text-blue-600 hover:underline">
            Inicia sesión
          </Link>
        </p>
      </section>
    </main>
  );
}
