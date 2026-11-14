'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { useToast } from '@/components/ui/toast-provider';
import { authClient } from '@/lib/auth-client';
import { mapAuthError } from '@/lib/auth-errors';

/**
 * F1-06 / RF-010: fija la nueva contrasena con el token de un solo uso.
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
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const invalidLink = !token || initialError === 'INVALID_TOKEN';

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < 8 || password.length > 64) {
      toast.error('La contraseña debe tener entre 8 y 64 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Las contraseñas no coinciden.');
      return;
    }
    setLoading(true);
    const { error } = await authClient.resetPassword({
      newPassword: password,
      token: token as string,
    });
    setLoading(false);
    if (error) {
      toast.error(
        mapAuthError(
          error,
          'El enlace es inválido o expiró. Solicita uno nuevo.',
        ),
        'No se pudo cambiar la contraseña',
      );
      return;
    }
    setDone(true);
    toast.success('Contraseña actualizada. Ya puedes iniciar sesión.');
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <section className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-gray-900">
          Nueva contraseña
        </h1>

        {invalidLink ? (
          <div className="mt-4 space-y-4">
            <p
              role="alert"
              className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              El enlace es inválido o ya expiró. Solicita uno nuevo para
              continuar.
            </p>
            <Link
              href="/forgot-password"
              className="block w-full rounded-md bg-blue-600 px-3 py-2 text-center text-sm font-medium text-white hover:bg-blue-700"
            >
              Solicitar nuevo enlace
            </Link>
          </div>
        ) : done ? (
          <div className="mt-4 space-y-4">
            <p
              role="status"
              className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800"
            >
              Tu contraseña se actualizó correctamente. Por seguridad se
              cerraron las sesiones abiertas.
            </p>
            <button
              type="button"
              onClick={() => router.push('/login')}
              className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Ir a iniciar sesión
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
            <p className="text-sm text-gray-600">
              Elige una contraseña de 8 a 64 caracteres.
            </p>
            <div>
              <label
                htmlFor="password"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Nueva contraseña
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
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-600 focus:outline-none"
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
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Guardando…' : 'Cambiar contraseña'}
            </button>
          </form>
        )}

        {!done && (
          <p className="mt-6 text-center text-sm text-gray-600">
            <Link
              href="/login"
              className="font-medium text-blue-600 hover:underline"
            >
              Volver a iniciar sesión
            </Link>
          </p>
        )}
      </section>
    </main>
  );
}
