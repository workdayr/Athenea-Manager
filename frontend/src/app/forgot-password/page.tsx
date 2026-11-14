'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { useToast } from '@/components/ui/toast-provider';
import { authClient } from '@/lib/auth-client';
import { mapAuthError } from '@/lib/auth-errors';

/**
 * F1-06 / RF-010: solicitud de recuperacion de contrasena.
 *
 * Por seguridad (anti-enumeracion) el backend responde igual exista o no
 * la cuenta; la pantalla muestra siempre el mismo mensaje de confirmacion.
 */
export default function ForgotPasswordPage() {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim()) {
      toast.error('Ingresa tu correo institucional.');
      return;
    }
    setLoading(true);
    const { error } = await authClient.requestPasswordReset({
      email: email.trim(),
    });
    setLoading(false);
    if (error) {
      toast.error(
        mapAuthError(
          error,
          'No fue posible solicitar el cambio de contraseña. Intenta de nuevo.',
        ),
        'No se pudo enviar el enlace',
      );
      return;
    }
    setSent(true);
    toast.success(
      'Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.',
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <section className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-gray-900">
          Recuperar contraseña
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Te enviaremos un enlace válido por 30 minutos para elegir una nueva
          contraseña.
        </p>

        {sent ? (
          <div className="mt-6 space-y-4">
            <p
              role="status"
              className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800"
            >
              Revisa la bandeja de entrada de <strong>{email.trim()}</strong> y
              sigue el enlace. Si no lo encuentras, revisa la carpeta de spam.
            </p>
            <button
              type="button"
              onClick={() => setSent(false)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Usar otro correo
            </button>
          </div>
        ) : (
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
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Enviando…' : 'Enviar enlace de recuperación'}
            </button>
          </form>
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
