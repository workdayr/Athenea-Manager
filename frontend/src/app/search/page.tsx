'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState, type FormEvent } from 'react';
import { AuthedShell } from '@/components/dashboard/authed-shell';
import { Icon } from '@/components/dashboard/icons';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Button, ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Input } from '@/components/ui/field';
import { PageHeader } from '@/components/ui/page-header';
import { Spinner } from '@/components/ui/spinner';
import { TableShell, Td, Th } from '@/components/ui/table';
import { useToast } from '@/components/ui/toast-provider';
import {
  SEARCH_TYPE_LABELS,
  searchAll,
  searchErrorMessage,
  type SearchPage,
  type SearchResultType,
} from '@/lib/search';

const TYPE_OPTIONS: Array<{ value: SearchResultType; label: string }> = [
  { value: 'PROJECT', label: SEARCH_TYPE_LABELS.PROJECT },
  { value: 'CALL', label: SEARCH_TYPE_LABELS.CALL },
  { value: 'USER', label: SEARCH_TYPE_LABELS.USER },
];

const TYPE_BADGES: Record<SearchResultType, string> = {
  PROJECT: 'border-brand-200 bg-brand-50 text-brand-800',
  CALL: 'border-success-line bg-success-soft text-success',
  USER: 'border-info-line bg-info-soft text-info',
};

export default function SearchPage() {
  return (
    <AuthedShell
      activeId="rag"
      searchPlaceholder="Buscar en tu conversación o en la documentación…"
    >
      {() => (
        <Suspense
          fallback={
            <div className="flex items-center gap-2 text-[13px] text-muted">
              <Spinner className="h-4 w-4" />
              Preparando la búsqueda…
            </div>
          }
        >
          <SearchContent />
        </Suspense>
      )}
    </AuthedShell>
  );
}

function SearchContent() {
  const toast = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  // El buscador del shell navega a /search?q=…: la pantalla debe arrancar
  // con ese término ya aplicado, no pedir que se escriba otra vez.
  const initialQuery = searchParams.get('q')?.trim() ?? '';
  const [input, setInput] = useState(initialQuery);
  const [appliedQuery, setAppliedQuery] = useState(initialQuery);
  const [selectedTypes, setSelectedTypes] = useState<SearchResultType[]>([]);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<SearchPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const query = appliedQuery.trim();
  const requestKey = `${query}|${selectedTypes.join(',')}|${page}|${reloadKey}`;
  const loading = query !== '' && loadedKey !== requestKey;

  useEffect(() => {
    if (!query) {
      return;
    }
    let active = true;
    searchAll(query, selectedTypes, page)
      .then((data) => {
        if (!active) {
          return;
        }
        setResult(data);
        setError(null);
        setLoadedKey(requestKey);
      })
      .catch((loadError: unknown) => {
        if (!active) {
          return;
        }
        const message = searchErrorMessage(loadError);
        setError(message);
        setResult(null);
        setLoadedKey(requestKey);
        toast.error(message);
      });
    return () => {
      active = false;
    };
  }, [query, selectedTypes, page, reloadKey, requestKey, toast]);

  function applyQuery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextQuery = input.trim();
    setPage(1);
    setAppliedQuery(nextQuery);
    router.replace(
      nextQuery ? `/search?q=${encodeURIComponent(nextQuery)}` : '/search',
      { scroll: false },
    );
  }

  function toggleType(type: SearchResultType) {
    setPage(1);
    setSelectedTypes((current) =>
      current.includes(type)
        ? current.filter((item) => item !== type)
        : [...current, type],
    );
  }

  const canSubmit = input.trim().length > 0;

  return (
    <div className="space-y-5">
      <Breadcrumbs
        items={[
          { label: 'Panel', href: '/dashboard' },
          { label: 'Búsqueda institucional' },
        ]}
      />

      <PageHeader
        title="Búsqueda institucional"
        description="Resultados de proyectos, convocatorias y usuarios con los permisos de tu rol (RF-012)."
      />

      <form onSubmit={applyQuery} className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1 basis-72">
          <label htmlFor="search-input" className="sr-only">
            Término de búsqueda
          </label>
          <Input
            id="search-input"
            label="Término"
            type="search"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Etiqueta, objetivo o convocatoria…"
          />
        </div>
        <Button type="submit" disabled={!canSubmit}>
          Buscar
        </Button>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        {TYPE_OPTIONS.map((option) => {
          const active = selectedTypes.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => toggleType(option.value)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors duration-150 ${
                active
                  ? 'border-brand-700 bg-brand-700 text-white'
                  : 'border-line bg-white text-ink hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800'
              }`}
            >
              {option.label}
            </button>
          );
        })}
        {selectedTypes.length > 0 && (
          <button
            type="button"
            onClick={() => setSelectedTypes([])}
            className="rounded-full border border-line bg-white px-3 py-1.5 text-xs font-medium text-muted transition-colors duration-150 hover:border-danger-line hover:bg-danger-soft hover:text-danger"
          >
            Limpiar tipos
          </button>
        )}
      </div>

      {query === '' && (
        <EmptyState
          className="bg-white px-6 py-12"
          icon={<Icon name="search" className="h-5 w-5" />}
          title="Empieza una búsqueda"
          description="Escribe un término y la búsqueda revisará el texto completo con las fuentes autorizadas a tu rol."
          action={
            <ButtonLink
              href="/assistant"
              variant="secondary"
              size="sm"
              leadingIcon={<Icon name="ai" className="h-4 w-4" />}
            >
              Preguntar al asistente
            </ButtonLink>
          }
        />
      )}

      {query !== '' && loading && (
        <div className="overflow-hidden rounded-xl border border-line bg-white" aria-busy="true">
          <span className="sr-only">Buscando resultados…</span>
          <div className="p-5">
            <div className="flex items-center gap-2 text-[13px] text-muted">
              <Spinner className="h-4 w-4" />
              Analizando fuentes autorizadas…
            </div>
            <div className="mt-4 space-y-3">
              {[0, 1, 2].map((index) => (
                <div
                  key={index}
                  className="rounded-lg border border-line bg-surface-2 p-3.5"
                >
                  <div className="h-3 w-2/3 rounded bg-line/60" />
                  <div className="mt-2 h-2.5 w-1/3 rounded bg-line/60" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {query !== '' && !loading && error && (
        <ErrorState
          className="min-h-[260px] justify-center bg-white"
          title="No se pudo completar la búsqueda"
          description={error}
          onRetry={() => {
            setError(null);
            setLoadedKey(null);
            setReloadKey((key) => key + 1);
          }}
        />
      )}

      {query !== '' && !loading && !error && result && (
        <section className="overflow-hidden rounded-xl border border-line bg-white">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-ink">
                {result.total} {result.total === 1 ? 'coincidencia' : 'coincidencias'}
              </h2>
              <p className="mt-0.5 text-xs text-muted">
                Página {result.page} de{' '}
                {Math.max(1, result.pageInfo.totalPages)}
              </p>
            </div>
          </header>

          {result.items.length === 0 ? (
            <div className="p-5">
              <EmptyState
                compact
                title="Sin resultados para estos criterios"
                description="Prueba con otro término o elimina los tipos de contenido seleccionados."
              />
            </div>
          ) : (
            <TableShell className="rounded-none border-0">
              <table className="w-full min-w-[680px] border-collapse">
                <caption className="sr-only">
                  Resultados de la búsqueda institucional con tipo, título y
                  subtítulo
                </caption>
                <thead>
                  <tr className="border-b border-line bg-surface-2">
                    <Th className="px-5">Tipo</Th>
                    <Th>Título</Th>
                    <Th className="px-5">Detalles</Th>
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((item) => (
                    <tr
                      key={`${item.type}-${item.id}`}
                      className="border-b border-line/70 transition-colors duration-150 hover:bg-surface-2"
                    >
                      <Td className="px-5">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${TYPE_BADGES[item.type] ?? 'border-line bg-surface-2 text-muted'}`}
                        >
                          {SEARCH_TYPE_LABELS[item.type]}
                        </span>
                      </Td>
                      <Td>
                        <Link
                          href={item.link ?? '/dashboard'}
                          className="block text-[12.5px] font-medium text-ink transition-colors duration-150 hover:text-brand-700 hover:underline"
                        >
                          {item.title}
                        </Link>
                      </Td>
                      <Td className="px-5 text-right text-[11.5px] text-muted">
                        {item.subtitle ?? '—'}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableShell>
          )}

          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3">
            <Button
              size="sm"
              variant="secondary"
              disabled={page <= 1 || !result.pageInfo.hasPreviousPage}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Anterior
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={page >= Math.max(1, result.pageInfo.totalPages) || !result.pageInfo.hasNextPage}
              onClick={() => setPage((current) => current + 1)}
            >
              Siguiente
            </Button>
          </footer>
        </section>
      )}
    </div>
  );
}
