'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { useToast } from '@/components/ui/toast-provider';
import { authClient } from '@/lib/auth-client';
import { mapAuthError, mapOAuthCallbackError } from '@/lib/auth-errors';

function frontendOrigin(): string {
  return window.location.origin;
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
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  // Descarta el banner de ?error= cuando el usuario interactua.
  const [dismissed, setDismissed] = useState(false);

  // Derivado de props (identico en servidor y cliente) + interaccion del
  // usuario. Al no guardarlo en state, las navegaciones client-side que
  // cambien ?error= tambien se reflejan.
  const oauthError = dismissed ? null : initialOAuthError;
  const displayError = mapOAuthCallbackError(oauthError);

  // El callback OAuth redirige aqui con ?error=... cuando algo falla.
  // Solo limpia la URL (sistema externo); el mensaje ya llego por props.
  useEffect(() => {
    if (window.location.search.includes('error=')) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDismissed(true);
    if (password.length < 8 || password.length > 64) {
      toast.error('La contraseña debe tener entre 8 y 64 caracteres.');
      return;
    }
    setLoading(true);
    const { error: signInError } = await authClient.signIn.email({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (signInError) {
      toast.error(
        mapAuthError(
          signInError,
          'No fue posible iniciar sesión. Intenta de nuevo.',
        ),
        'No se pudo iniciar sesión',
      );
      return;
    }
    toast.success('Sesión iniciada. Redirigiendo al panel…');
    router.push('/dashboard');
  }

  async function handleGoogleSignIn() {
    setDismissed(true);
    setGoogleLoading(true);
    const { error: socialError } = await authClient.signIn.social({
      provider: 'google',
      callbackURL: `${frontendOrigin()}/dashboard`,
      errorCallbackURL: `${frontendOrigin()}/login`,
    });
    setGoogleLoading(false);
    if (socialError) {
      toast.error(
        mapAuthError(
          socialError,
          'El inicio con Google no está disponible por el momento. Usa tu correo y contraseña.',
        ),
        'No se pudo continuar con Google',
      );
    }
    // Sin error el cliente redirige solo a Google.
  }

  const inputClassName =
    'w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:border-blue-600 focus:outline-none';

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <section className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-gray-900">
          Athenea Manager
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Inicia sesión con tu correo institucional.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
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
                <div className="mb-1 flex items-baseline justify-between">
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Contraseña
                  </label>
                  <Link
                    href="/forgot-password"
                    className="text-xs font-medium text-blue-600 hover:underline"
                  >
                    ¿Olvidaste tu contraseña?
                  </Link>
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  minLength={8}
                  maxLength={64}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
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
                {loading ? 'Ingresando…' : 'Ingresar'}
              </button>
            </form>

            <div className="mt-4">
              <button
                type="button"
                disabled={loading || googleLoading}
                onClick={handleGoogleSignIn}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {googleLoading
                  ? 'Conectando con Google…'
                  : 'Continuar con Google institucional'}
              </button>
            </div>

        <p className="mt-6 text-center text-sm text-gray-600">
          ¿No tienes cuenta?{' '}
          <Link href="/register" className="font-medium text-blue-600 hover:underline">
            Regístrate
          </Link>
        </p>

        <p className="mt-2 text-center text-sm text-gray-600">
          ¿Aún no verificas tu correo?{' '}
          <Link
            href="/verify-email"
            className="font-medium text-blue-600 hover:underline"
          >
            Reenviar verificación
          </Link>
        </p>
      </section>
    </main>
  );
}
