'use client';

import { useEffect, type FormEvent, type KeyboardEvent, type RefObject } from 'react';
import { Icon } from '@/components/dashboard/icons';

const MAX_LENGTH = 1000;

export function Composer({
  value,
  onChange,
  onSubmit,
  onStop,
  pending,
  textareaRef,
  roleLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  pending: boolean;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  roleLabel: string;
}) {
  // El alto crece con el contenido hasta un maximo para no empujar el chat.
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 152)}px`;
  }, [value, textareaRef]);

  function submit() {
    if (!pending && value.trim()) {
      onSubmit();
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submit();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key === 'Enter' &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border-t border-line bg-white px-3 pb-3 pt-2.5 lg:px-6 lg:pb-4"
    >
      <div className="mx-auto w-full max-w-3xl">
        <div
          className={`rounded-xl border bg-white p-2 shadow-sm transition ${
            pending
              ? 'border-brand-200'
              : 'border-line focus-within:border-brand-300'
          }`}
        >
          <label htmlFor="assistant-question" className="sr-only">
            Escribe tu pregunta sobre políticas o expedientes institucionales
          </label>
          <textarea
            id="assistant-question"
            ref={textareaRef}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            maxLength={MAX_LENGTH}
            disabled={pending}
            placeholder="Pregunta sobre políticas, convocatorias o expedientes…"
            aria-describedby="assistant-composer-hint"
            className="block max-h-[152px] min-h-[44px] w-full resize-none overflow-y-auto bg-transparent px-2 py-1.5 text-sm leading-relaxed text-ink placeholder:text-[#8a93a8] focus:outline-none disabled:cursor-not-allowed disabled:opacity-70"
          />
          <div className="flex items-center justify-between gap-2 px-1">
            <span className="text-[10px] text-muted">
              {value.length > 800
                ? `${value.length}/${MAX_LENGTH}`
                : 'Enter para enviar · Shift+Enter para nueva línea'}
            </span>

            {pending ? (
              <button
                type="button"
                onClick={onStop}
                className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 text-[11px] font-semibold text-muted transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
              >
                <Icon name="stop" className="h-3.5 w-3.5" />
                Detener
              </button>
            ) : (
              <button
                type="submit"
                disabled={!value.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-brand-800 to-brand-600 px-3.5 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:from-brand-900 hover:to-brand-700 disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-1"
              >
                <Icon name="send" className="h-3.5 w-3.5" />
                Enviar
              </button>
            )}
          </div>
        </div>

        <p
          id="assistant-composer-hint"
          className="mt-2 flex items-start gap-1.5 text-[10px] leading-relaxed text-muted"
        >
          <Icon
            name="shield"
            className="mt-px h-3 w-3 shrink-0 text-brand-600"
          />
          <span>
            El asistente consulta solo documentos autorizados para{' '}
            <strong className="font-semibold text-ink">{roleLabel}</strong> y no
            puede modificar proyectos, documentos ni dictámenes.
          </span>
        </p>
      </div>
    </form>
  );
}
