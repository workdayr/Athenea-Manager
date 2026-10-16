'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

/**
 * RF-001: pagina mostrada cuando un usuario autenticado intenta acceder
 * a una operacion que su rol no permite (error FORBIDDEN del backend).
 *
 * El `errorLink` de Apollo redirige aqui. Tambien puede visitarse
 * directamente (por ejemplo, desde el menu si un rol no aplica).
 */
export default function AccessDeniedPage() {
  const router = useRouter();

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <section className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
          <svg
            className="h-6 w-6 text-red-600"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="1.5"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-semibold text-gray-900">
          Acceso denegado
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          No tienes permisos para ver esta sección. Si crees que es un error,
          contacta al administrador del sistema.
        </p>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Volver
          </button>
          <Link
            href="/dashboard"
            className="flex-1 rounded-md bg-blue-600 px-3 py-2 text-center text-sm font-medium text-white hover:bg-blue-700"
          >
            Ir al inicio
          </Link>
        </div>
      </section>
    </main>
  );
}