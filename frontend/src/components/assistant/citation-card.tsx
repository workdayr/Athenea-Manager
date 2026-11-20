import Link from 'next/link';
import { Icon } from '@/components/dashboard/icons';
import {
  citationHref,
  citationLocation,
  type AssistantCitation,
} from '@/lib/assistant';

/**
 * Tarjeta de fuente: titulo, ubicacion, fragmento y enlace
 * directo al documento interno. El id permite que los marcadores [n]
 * del mensaje desplacen la vista hasta aqui.
 */
export function CitationCard({
  citation,
  index,
  messageId,
  highlighted,
}: {
  citation: AssistantCitation;
  index: number;
  messageId: string;
  highlighted: boolean;
}) {
  const location = citationLocation(citation);

  return (
    <Link
      id={`citation-${messageId}-${index}`}
      href={citationHref(citation)}
      target="_blank"
      rel="noreferrer"
      className={`group flex h-full scroll-mt-24 flex-col rounded-lg border p-3 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 ${
        highlighted
          ? 'border-brand-400 bg-brand-50 ring-2 ring-brand-200'
          : 'border-line bg-[#fbfcff] hover:border-brand-200 hover:bg-brand-50/50'
      }`}
    >
      <span className="flex items-start gap-2">
        <span className="grid h-5 min-w-5 place-items-center rounded bg-brand-100 px-1 text-[10px] font-bold text-brand-800">
          {index}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-semibold leading-snug text-ink">
            {citation.documentTitle}
          </span>
          <span className="mt-0.5 block text-[9.5px] leading-snug text-muted">
            {citation.documentType}
            {location ? ` · ${location}` : ''}
          </span>
        </span>
        <Icon
          name="arrowUpRight"
          className="h-3.5 w-3.5 shrink-0 text-muted transition group-hover:text-brand-600"
        />
      </span>

      <span className="mt-2 line-clamp-3 border-l-2 border-brand-200 pl-2 text-[10.5px] italic leading-relaxed text-muted">
        “{citation.excerpt}”
      </span>

      <span className="mt-auto pt-2 text-[10px] font-semibold text-brand-700">
        Abrir documento
      </span>
    </Link>
  );
}
