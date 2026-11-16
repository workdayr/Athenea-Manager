'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

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
    <main className="flex min-h-screen items-center justify-center bg-surface px-4 py-10">
      <section className="w-full max-w-md animate-fade-up rounded-2xl border border-line bg-white p-7 shadow-card sm:p-8">
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-danger-soft text-danger">
          <svg
            className="h-5 w-5"
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

        <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-ink">
          Acceso denegado
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          Tu cuenta no tiene permisos para esta sección. Si crees que es un
          error, contacta al administrador del sistema.
        </p>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Button
            variant="secondary"
            fullWidth
            onClick={() => router.back()}
          >
            Volver
          </Button>
          <Link
            href="/dashboard"
            className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white transition-colors duration-150 hover:bg-brand-800"
          >
            Ir al inicio
          </Link>
        </div>

        <p className="mt-4 text-center text-xs text-muted">
          ¿Tu sesión expiró?{' '}
          <Link
            href="/login"
            className="font-medium text-brand-700 underline-offset-4 hover:underline"
          >
            Inicia sesión de nuevo
          </Link>
        </p>
      </section>
    </main>
  );
}
