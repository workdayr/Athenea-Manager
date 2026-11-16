import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="w-full max-w-md rounded-xl border border-line bg-white px-6 py-12 text-center">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted">
          Athenea Manager
        </p>
        <h1 className="mt-2 text-xl font-semibold text-ink">
          Página no encontrada
        </h1>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
          El recurso que buscas no existe o fue movido. Vuelve al panel para
          continuar con tu trabajo.
        </p>
        <Link
          href="/dashboard"
          className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-brand-800"
        >
          Volver al panel
        </Link>
      </div>
    </div>
  );
}
