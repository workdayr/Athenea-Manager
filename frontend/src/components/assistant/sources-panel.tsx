import Link from 'next/link';
import { Icon } from '@/components/dashboard/icons';
import {
  citationHref,
  citationLocation,
  type AssistantMessage,
} from '@/lib/assistant';

/**
 * Panel de trazabilidad (AIR-003). Muestra las fuentes de la ultima
 * respuesta fundamentada; si la respuesta fue un rechazo, explica que no
 * se uso ningun fragmento.
 */
export function SourcesPanel({
  message,
  onClose,
}: {
  message: AssistantMessage | null;
  onClose: () => void;
}) {
  const citations = message?.citations ?? [];

  return (
    <aside
      id="assistant-sources"
      aria-label="Fuentes consultadas"
      className="hidden w-[300px] shrink-0 flex-col border-l border-line bg-[#fbfcff] xl:flex"
    >
      <div className="flex items-start justify-between gap-2 border-b border-line px-4 py-4">
        <div className="min-w-0">
          <p className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-muted">
            Trazabilidad
          </p>
          <h2 className="mt-0.5 text-[13px] font-semibold text-ink">
            Fuentes consultadas
          </h2>
          <p className="mt-1 text-[10px] leading-relaxed text-muted">
            Cada respuesta enlaza al documento autorizado que la fundamenta.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Colapsar fuentes consultadas"
          title="Colapsar fuentes consultadas"
          className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted transition hover:bg-brand-50 hover:text-brand-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
        >
          <Icon name="chevronRight" className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {!message ? (
          <div className="rounded-lg border border-dashed border-line bg-white/60 px-3 py-6 text-center">
            <Icon name="doc" className="mx-auto h-5 w-5 text-muted/60" />
            <p className="mt-2 text-[10.5px] leading-relaxed text-muted">
              Las fuentes de la última respuesta aparecerán aquí.
            </p>
          </div>
        ) : citations.length === 0 ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-4">
            <Icon name="info" className="h-4 w-4 text-amber-700" />
            <p className="mt-1.5 text-[10.5px] leading-relaxed text-amber-900">
              Esta respuesta no utilizó fuentes: no se encontró contexto
              autorizado suficiente para fundamentarla.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {citations.map((citation, index) => {
              const location = citationLocation(citation);
              return (
                <li key={citation.id}>
                  <Link
                    href={citationHref(citation)}
                    target="_blank"
                    rel="noreferrer"
                    className="group block rounded-lg border border-line bg-white p-3 transition hover:border-brand-200 hover:bg-brand-50/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
                  >
                    <span className="flex items-start gap-2">
                      <span className="grid h-5 min-w-5 place-items-center rounded bg-brand-100 px-1 text-[9.5px] font-bold text-brand-800">
                        {index + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[10.5px] font-semibold leading-snug text-ink">
                          {citation.documentTitle}
                        </span>
                        <span className="mt-0.5 block text-[9px] leading-snug text-muted">
                          {citation.documentType}
                          {location ? ` · ${location}` : ''}
                        </span>
                      </span>
                      <Icon
                        name="arrowUpRight"
                        className="h-3 w-3 shrink-0 text-muted transition group-hover:text-brand-600"
                      />
                    </span>
                    <span className="mt-2 line-clamp-3 border-l-2 border-brand-100 pl-2 text-[9.5px] italic leading-relaxed text-muted">
                      “{citation.excerpt}”
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="border-t border-line p-3">
        <div className="rounded-lg border border-line bg-white p-3">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold text-ink">
            <Icon name="stamp" className="h-3.5 w-3.5 text-brand-600" />
            Operación de solo lectura
          </p>
          <p className="mt-1 text-[9.5px] leading-relaxed text-muted">
            El asistente no puede aprobar proyectos, cambiar visibilidades ni
            modificar información oficial (AIR-002).
          </p>
        </div>
      </div>
    </aside>
  );
}
