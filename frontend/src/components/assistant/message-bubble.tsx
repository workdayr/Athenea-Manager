'use client';

import { Fragment, useState } from 'react';
import { Icon } from '@/components/dashboard/icons';
import {
  REFUSAL_FOLLOW_UPS,
  formatMessageTime,
  type AssistantCitation,
  type AssistantMessage,
} from '@/lib/assistant';
import { AssistantAvatar } from './assistant-avatar';
import { CitationCard } from './citation-card';

type Highlight = { messageId: string; index: number } | null;

export function MessageBubble({
  message,
  highlight,
  onCitationClick,
  onSelectPrompt,
}: {
  message: AssistantMessage;
  highlight: Highlight;
  onCitationClick: (messageId: string, index: number) => void;
  onSelectPrompt: (prompt: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [sourcesExpanded, setSourcesExpanded] = useState(true);
  const isUser = message.role === 'user';
  const isRefusal = !isUser && message.grounded === false;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Sin permiso de portapapeles: el boton no cambia de estado.
    }
  }

  return (
    <article
      className={`flex items-start gap-2.5 ${isUser ? 'justify-end' : ''}`}
    >
      {!isUser && <AssistantAvatar className="mt-0.5 h-8 w-8" />}

      <div
        className={`min-w-0 ${isUser ? 'max-w-[85%] sm:max-w-[75%]' : 'max-w-[92%] flex-1 sm:max-w-[85%]'}`}
      >
        <div
          className={`rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed shadow-sm ${
            isUser
              ? 'rounded-br-md bg-brand-800 text-white'
              : isRefusal
                ? 'rounded-bl-md border border-amber-200 bg-amber-50/70 text-ink'
                : 'rounded-bl-md border border-line bg-white text-ink'
          }`}
        >
          {isRefusal && (
            <span className="mb-1.5 inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-100/70 px-2 py-0.5 text-[9.5px] font-semibold text-amber-900">
              <Icon name="info" className="h-3 w-3" />
              Sin información suficiente
            </span>
          )}
          <RichText
            content={message.content}
            citations={message.citations}
            messageId={message.id}
            isUser={isUser}
            onCitationClick={(messageId, index) => {
              setSourcesExpanded(true);
              onCitationClick(messageId, index);
            }}
          />
        </div>

        <div
          className={`mt-1 flex items-center gap-2 px-1 text-[9.5px] text-muted ${
            isUser ? 'justify-end' : ''
          }`}
        >
          <time dateTime={message.createdAt}>
            {formatMessageTime(message.createdAt)}
          </time>
          {!isUser && (
            <button
              type="button"
              onClick={() => void handleCopy()}
              className="inline-flex items-center gap-1 rounded px-1 py-0.5 transition hover:bg-brand-50 hover:text-brand-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
              aria-label="Copiar respuesta del asistente"
            >
              <Icon name="copy" className="h-3 w-3" />
              {copied ? 'Copiado' : 'Copiar'}
            </button>
          )}
        </div>

        {!isUser && message.citations.length > 0 && (
          <div className="mt-2.5">
            <button
              type="button"
              onClick={() => setSourcesExpanded((expanded) => !expanded)}
              aria-expanded={sourcesExpanded}
              aria-label={
                sourcesExpanded
                  ? 'Colapsar fuentes consultadas de esta respuesta'
                  : 'Expandir fuentes consultadas de esta respuesta'
              }
              className="mb-1.5 flex w-full items-center gap-1.5 rounded text-left text-[9.5px] font-semibold uppercase tracking-[0.08em] text-muted transition hover:text-brand-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
            >
              <Icon name="doc" className="h-3.5 w-3.5 text-brand-600" />
              Fuentes consultadas · {message.citations.length}
              <Icon
                name={sourcesExpanded ? 'chevronDown' : 'chevronRight'}
                className="ml-auto h-3.5 w-3.5"
              />
            </button>
            {sourcesExpanded && (
              <div className="grid gap-2 sm:grid-cols-2">
                {message.citations.map((citation, index) => (
                  <CitationCard
                    key={citation.id}
                    citation={citation}
                    index={index + 1}
                    messageId={message.id}
                    highlighted={
                      highlight?.messageId === message.id &&
                      highlight.index === index + 1
                    }
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {!isUser && isRefusal && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-[9.5px] text-muted">Puedes intentar:</span>
            {REFUSAL_FOLLOW_UPS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => onSelectPrompt(prompt)}
                className="rounded-full border border-line bg-white px-2.5 py-1 text-[9.5px] font-medium text-brand-800 transition hover:border-brand-200 hover:bg-brand-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
              >
                {prompt}
              </button>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

/**
 * Render minimo de texto enriquecido: parrafos, listas, negritas y
 * marcadores de cita [n]. Se evita HTML sin sanitizar.
 */
function RichText({
  content,
  citations,
  messageId,
  isUser,
  onCitationClick,
}: {
  content: string;
  citations: AssistantCitation[];
  messageId: string;
  isUser: boolean;
  onCitationClick: (messageId: string, index: number) => void;
}) {
  const blocks = content
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  return (
    <div className="space-y-2">
      {blocks.map((block, blockIndex) => {
        const lines = block
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean);
        const isList =
          lines.length > 0 && lines.every((line) => line.startsWith('- '));

        if (isList) {
          return (
            <ul
              key={blockIndex}
              className={`list-disc space-y-1 pl-4 marker:text-brand-400 ${
                isUser ? 'marker:text-white/70' : ''
              }`}
            >
              {lines.map((line, lineIndex) => (
                <li key={lineIndex}>
                  {renderInline(
                    line.slice(2),
                    citations,
                    messageId,
                    onCitationClick,
                  )}
                </li>
              ))}
            </ul>
          );
        }

        return (
          <p key={blockIndex}>
            {lines.map((line, lineIndex) => (
              <Fragment key={lineIndex}>
                {lineIndex > 0 && <br />}
                {renderInline(line, citations, messageId, onCitationClick)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}

function renderInline(
  text: string,
  citations: AssistantCitation[],
  messageId: string,
  onCitationClick: (messageId: string, index: number) => void,
) {
  const tokens = text
    .split(/(\[\d+\]|\*\*[^*]+\*\*)/g)
    .filter((token) => token !== '');

  return tokens.map((token, index) => {
    const citationMatch = /^\[(\d+)\]$/.exec(token);
    if (citationMatch) {
      const number = Number(citationMatch[1]);
      const citation = citations[number - 1];
      if (!citation) {
        return <Fragment key={index}>{token}</Fragment>;
      }
      return (
        <button
          key={index}
          type="button"
          onClick={() => onCitationClick(messageId, number)}
          aria-label={`Ver fuente ${number}: ${citation.documentTitle}`}
          className="mx-0.5 inline-grid h-[17px] min-w-[17px] translate-y-[-1px] place-items-center rounded bg-brand-100 px-1 align-baseline text-[9px] font-bold text-brand-800 transition hover:bg-brand-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        >
          {number}
        </button>
      );
    }

    const boldMatch = /^\*\*([^*]+)\*\*$/.exec(token);
    if (boldMatch) {
      return (
        <strong key={index} className="font-semibold">
          {boldMatch[1]}
        </strong>
      );
    }

    return <Fragment key={index}>{token}</Fragment>;
  });
}
