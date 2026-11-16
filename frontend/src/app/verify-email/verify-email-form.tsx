'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { useToast } from '@/components/ui/toast-provider';
import { authClient } from '@/lib/auth-client';
import { mapAuthError } from '@/lib/auth-errors';
import { verificationConfirmationHref } from '@/lib/verify-email';

/**
 * F1-06 / RF-010: confirma el correo con el token del enlace y permite
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
  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);
  const [resent, setResent] = useState(false);

  async function handleResend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim()) {
      toast.error('Ingresa tu correo institucional.');
      return;
    }
    setLoading(true);
    const { error } = await authClient.sendVerificationEmail({
      email: email.trim(),
      callbackURL: `${window.location.origin}/verify-email`,
    });
    setLoading(false);
    if (error) {
      toast.error(
        mapAuthError(
          error,
          'No fue posible reenviar el correo de verificación. Intenta de nuevo.',
        ),
        'No se pudo reenviar',
      );
      return;
    }
    setResent(true);
    toast.success(
      'Si la cuenta existe y no está verificada, recibirás un nuevo enlace.',
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <section className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-gray-900">
          Verificación de correo
        </h1>

        {verified ? (
          <div className="mt-4 space-y-4">
            <p
              role="status"
              className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800"
            >
              Tu correo quedó verificado. Ya puedes iniciar sesión con tu
              cuenta institucional.
            </p>
            <Link
              href="/login"
              className="block w-full rounded-md bg-blue-600 px-3 py-2 text-center text-sm font-medium text-white hover:bg-blue-700"
            >
              Ir a iniciar sesión
            </Link>
          </div>
        ) : (
          <>
            {error && (
              <p
                role="alert"
                className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                {error === 'TOKEN_EXPIRED'
                  ? 'El enlace de verificación expiró. Solicita uno nuevo.'
                  : 'El enlace de verificación no es válido. Solicita uno nuevo.'}
              </p>
            )}
            {token ? (
              <div className="mt-4 space-y-4">
                <p className="text-sm text-gray-600">
                  Confirma que este es tu correo institucional. Al verificar,
                  podrás iniciar sesión en la plataforma.
                </p>
                <a
                  href={verificationConfirmationHref(token)}
                  className="block w-full rounded-md bg-blue-600 px-3 py-2 text-center text-sm font-medium text-white hover:bg-blue-700"
                >
                  Confirmar mi correo
                </a>
              </div>
            ) : (
              <p className="mt-4 text-sm text-gray-600">
                Abre el enlace que enviamos a tu correo institucional. Si no lo
                recibiste o expiró, solicita uno nuevo aquí abajo.
              </p>
            )}

            <form
              onSubmit={handleResend}
              className="mt-6 space-y-3 border-t border-gray-200 pt-6"
              noValidate
            >
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700"
              >
                Reenviar enlace de verificación
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
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:border-blue-600 focus:outline-none"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {loading
                  ? 'Enviando…'
                  : resent
                    ? 'Reenviar de nuevo'
                    : 'Reenviar correo'}
              </button>
            </form>
          </>
        )}

        <p className="mt-6 text-center text-sm text-gray-600">
          <Link
            href="/login"
            className="font-medium text-blue-600 hover:underline"
          >
            Volver a iniciar sesión
          </Link>
        </p>
      </section>
    </main>
  );
}
