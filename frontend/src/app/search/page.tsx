'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useToast } from '@/components/ui/toast-provider';
import {
  SEARCH_TYPE_LABELS,
  searchAll,
  searchErrorMessage,
  type SearchPage,
  type SearchResultType,
} from '@/lib/search';

const TYPE_OPTIONS: SearchResultType[] = ['PROJECT', 'CALL', 'USER'];

export default function SearchPage() {
  return (
    <Suspense fallback={<SearchFallback />}>
      <SearchContent />
    </Suspense>
  );
}

function SearchFallback() {
  return (
    <main className="min-h-screen bg-surface px-4 py-10">
      <p className="mx-auto max-w-4xl text-sm text-muted">Cargando busqueda…</p>
    </main>
  );
}

function SearchContent() {
  const params = useSearchParams();
  const toast = useToast();
  const query = (params.get('q') ?? '').trim();
  const [selectedTypes, setSelectedTypes] = useState<SearchResultType[]>([]);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<SearchPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPage(1);
  }, [query]);

  useEffect(() => {
    if (!query) {
      setResult(null);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    searchAll(query, selectedTypes, page)
      .then((data) => {
        if (active) {
          setResult(data);
        }
      })
      .catch((loadError: unknown) => {
        if (!active) {
          return;
        }
        const message = searchErrorMessage(loadError);
        setError(message);
        toast.error(message);
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [query, selectedTypes, page, toast]);

  function toggleType(type: SearchResultType) {
    setPage(1);
    setSelectedTypes((current) =>
      current.includes(type)
        ? current.filter((item) => item !== type)
        : [...current, type],
    );
  }

  return (
    <main className="min-h-screen bg-surface px-4 py-10">
      <div className="mx-auto w-full max-w-4xl">
        <Link
          href="/dashboard"
          className="text-xs font-semibold uppercase tracking-wide text-brand-700 hover:underline"
        >
          ← Volver al panel
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-ink">
          Busqueda institucional
        </h1>
        <p className="mt-1 text-sm text-muted">
          Resultados de proyectos, convocatorias y usuarios con los permisos de
          tu rol (RF-012).
        </p>

        <div className="mt-5 rounded-xl border border-line bg-white p-4 shadow-sm">
          <p className="text-sm text-ink">
            {query ? (
              <>
                Resultados para <strong>&ldquo;{query}&rdquo;</strong>
              </>
            ) : (
              'Escribe una busqueda desde la barra superior.'
            )}
          </p>
          <div className="mt-3 flex flex-wrap gap-2" aria-label="Filtrar por tipo">
            {TYPE_OPTIONS.map((type) => {
              const active = selectedTypes.includes(type);
              return (
                <button
                  key={type}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleType(type)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    active
                      ? 'border-brand-600 bg-brand-600 text-white'
                      : 'border-line bg-white text-ink hover:bg-brand-50'
                  }`}
                >
                  {SEARCH_TYPE_LABELS[type]}
                </button>
              );
            })}
          </div>
        </div>

        {!query && (
          <p className="mt-8 rounded-xl border border-dashed border-line bg-white p-8 text-center text-sm text-muted">
            La busqueda usa texto completo en espanol y respeta la
            confidencialidad de los proyectos (BR-007).
          </p>
        )}

        {query && loading && (
          <p className="mt-8 text-sm text-muted">Buscando…</p>
        )}

        {query && !loading && error && (
          <div className="mt-8 rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            {error}
          </div>
        )}

        {query && !loading && !error && result && (
          <section className="mt-6 overflow-hidden rounded-xl border border-line bg-white shadow-sm">
            <header className="flex items-center justify-between border-b border-line px-5 py-3">
              <h2 className="text-sm font-semibold text-ink">
                {result.total} coincidencia(s)
              </h2>
              <span className="text-xs text-muted">
                Pagina {result.page} de {Math.max(1, result.pageInfo.totalPages)}
              </span>
            </header>
            {result.items.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-muted">
                No se encontraron resultados con los filtros actuales.
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {result.items.map((item) => (
                  <li key={`${item.type}-${item.id}`}>
                    <Link
                      href={item.link ?? '/dashboard'}
                      className="block px-5 py-4 transition hover:bg-brand-50/60"
                    >
                      <span className="inline-flex rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-800">
                        {SEARCH_TYPE_LABELS[item.type]}
                      </span>
                      <span className="mt-1 block text-sm font-semibold text-ink">
                        {item.title}
                      </span>
                      {item.subtitle && (
                        <span className="mt-0.5 line-clamp-2 block text-xs text-muted">
                          {item.subtitle}
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <footer className="flex items-center justify-between border-t border-line px-5 py-3">
              <button
                type="button"
                disabled={!result.pageInfo.hasPreviousPage}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="rounded-md border border-line px-3 py-1.5 text-xs font-medium text-ink disabled:opacity-40"
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={!result.pageInfo.hasNextPage}
                onClick={() => setPage((current) => current + 1)}
                className="rounded-md border border-line px-3 py-1.5 text-xs font-medium text-ink disabled:opacity-40"
              >
                Siguiente
              </button>
            </footer>
          </section>
        )}
      </div>
    </main>
  );
}
