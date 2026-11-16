'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/dashboard/icons';
import { ROLE_LABELS, type DashboardUser } from '@/lib/dashboard';
import {
  SUGGESTED_PROMPTS,
  createAssistantMessage,
  createUserMessage,
  getAssistantGateway,
  isAssistantDemo,
  type AssistantMessage,
} from '@/lib/assistant';
import { useAssistantHistory } from '@/lib/assistant-history';
import { AssistantAvatar } from './assistant-avatar';
import { Composer } from './composer';
import { HistorySidebar } from './history-sidebar';
import { MessageList } from './message-list';
import { SourcesPanel } from './sources-panel';

/**
 * Asistente Virtual RAG (UC-010 / RF-010).
 *
 * La pantalla no conoce detalles del modelo ni del indice: solo habla con
 * `AssistantGateway`. El contexto se filtra por rol en el backend real;
 * aqui el indicador de alcance y el historial local reproducen la misma
 * experiencia (AIR-001..005).
 */
export function AssistantChat({
  user,
  searchQuery,
}: {
  user: DashboardUser;
  searchQuery: string;
}) {
  const {
    conversations,
    createConversation,
    appendMessages,
    renameConversation,
    deleteConversation,
  } = useAssistantHistory();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryQuestion, setRetryQuestion] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyCollapsed, setHistoryCollapsed] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(true);
  const [highlight, setHighlight] = useState<{
    messageId: string;
    index: number;
  } | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const highlightTimer = useRef<number | null>(null);

  const activeConversation =
    conversations.find((conversation) => conversation.id === activeId) ?? null;
  const messages = activeConversation?.messages ?? [];

  const lastAssistantMessage = (() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index].role === 'assistant') {
        return messages[index];
      }
    }
    return null;
  })();

  useEffect(() => {
    textareaRef.current?.focus();
  }, [activeId]);

  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) {
      return;
    }
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    scroller.scrollTo({
      top: scroller.scrollHeight,
      behavior: reduced ? 'auto' : 'smooth',
    });
  }, [messages.length, pending, activeId, error]);

  useEffect(() => {
    return () => {
      const controller = abortRef.current;
      abortRef.current = null;
      controller?.abort();
      if (highlightTimer.current !== null) {
        window.clearTimeout(highlightTimer.current);
      }
    };
  }, []);

  async function requestAnswer(
    conversationId: string,
    question: string,
    history: AssistantMessage[],
  ) {
    setPending(true);
    setError(null);
    setRetryQuestion(null);

    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;

    try {
      const answer = await getAssistantGateway().ask(
        {
          question,
          conversationId,
          history: history.map(({ role, content }) => ({ role, content })),
        },
        controller.signal,
      );
      appendMessages(conversationId, [createAssistantMessage(answer)]);
    } catch (requestError: unknown) {
      if (requestError instanceof Error && requestError.name === 'AbortError') {
        return;
      }
      setError(
        'No se pudo obtener una respuesta del asistente. Revisa tu conexión e intenta de nuevo.',
      );
      setRetryQuestion(question);
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        setPending(false);
      }
    }
  }

  function submitQuestion(raw: string) {
    const question = raw.trim();
    if (!question || pending) {
      return;
    }

    const userMessage = createUserMessage(question);
    setDraft('');
    setError(null);
    setRetryQuestion(null);

    let conversationId = activeId;
    let history: AssistantMessage[];

    if (conversationId) {
      const current = conversations.find(
        (conversation) => conversation.id === conversationId,
      );
      history = [...(current?.messages ?? []), userMessage];
      appendMessages(conversationId, [userMessage]);
    } else {
      const conversation = createConversation(userMessage);
      conversationId = conversation.id;
      setActiveId(conversation.id);
      history = [userMessage];
    }

    void requestAnswer(conversationId, question, history);
  }

  function handleRetry() {
    if (!retryQuestion || !activeId || pending) {
      return;
    }
    const current = conversations.find(
      (conversation) => conversation.id === activeId,
    );
    void requestAnswer(activeId, retryQuestion, current?.messages ?? []);
  }

  function handleStop() {
    abortRef.current?.abort();
    abortRef.current = null;
    setPending(false);
  }

  function handleNewChat() {
    abortRef.current?.abort();
    abortRef.current = null;
    setPending(false);
    setActiveId(null);
    setDraft('');
    setError(null);
    setRetryQuestion(null);
    setHistoryOpen(false);
    window.setTimeout(() => textareaRef.current?.focus(), 0);
  }

  function handleSelectConversation(conversationId: string) {
    if (conversationId !== activeId) {
      abortRef.current?.abort();
      abortRef.current = null;
      setPending(false);
      setActiveId(conversationId);
      setDraft('');
      setError(null);
      setRetryQuestion(null);
    }
    setHistoryOpen(false);
  }

  function handleDeleteConversation(conversationId: string) {
    deleteConversation(conversationId);
    if (conversationId === activeId) {
      abortRef.current?.abort();
      abortRef.current = null;
      setPending(false);
      setActiveId(null);
      setError(null);
      setRetryQuestion(null);
    }
  }

  function handleCitationClick(messageId: string, index: number) {
    setHighlight({ messageId, index });
    // Se espera un frame para que, si las fuentes estaban colapsadas, el
    // marcador [n] encuentre la tarjeta ya montada en el DOM.
    window.requestAnimationFrame(() => {
      const target = document.getElementById(`citation-${messageId}-${index}`);
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });

    if (highlightTimer.current !== null) {
      window.clearTimeout(highlightTimer.current);
    }
    highlightTimer.current = window.setTimeout(
      () => setHighlight(null),
      2400,
    );
  }

  const roleLabel = ROLE_LABELS[user.role];
  const demoMode = isAssistantDemo();
  const sourceCount = lastAssistantMessage?.citations.length ?? 0;

  return (
    <>
      <div className="flex h-[calc(100dvh-7.5rem)] min-h-[560px] overflow-hidden rounded-xl border border-line bg-white shadow-sm lg:h-[calc(100dvh-8.5rem)]">
        {historyCollapsed ? (
          <aside
            id="assistant-history"
            aria-label="Conversaciones (colapsadas)"
            className="hidden w-12 shrink-0 flex-col items-center border-r border-line bg-[#fbfcff] py-3 lg:flex"
          >
            <button
              type="button"
              onClick={() => setHistoryCollapsed(false)}
              aria-expanded={false}
              aria-controls="assistant-history"
              aria-label="Mostrar conversaciones"
              title="Mostrar conversaciones"
              className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-white text-muted transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
            >
              <Icon name="chevronRight" className="h-4 w-4" />
            </button>
            {conversations.length > 0 && (
              <span className="mt-1.5 rounded-full bg-brand-100 px-1.5 text-[9px] font-bold text-brand-800">
                {conversations.length}
              </span>
            )}
            <button
              type="button"
              onClick={handleNewChat}
              aria-label="Nueva conversación"
              title="Nueva conversación"
              className="mt-2 grid h-9 w-9 place-items-center rounded-lg text-muted transition hover:bg-brand-50 hover:text-brand-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
            >
              <Icon name="plus" className="h-4 w-4" />
            </button>
            <span className="mt-3 text-[9px] font-semibold uppercase tracking-[0.18em] text-muted [writing-mode:vertical-rl]">
              Conversaciones
            </span>
          </aside>
        ) : (
          <aside
            id="assistant-history"
            className="hidden w-[264px] shrink-0 border-r border-line lg:block"
          >
            <HistorySidebar
              conversations={conversations}
              activeId={activeId}
              searchQuery={searchQuery}
              onNewChat={handleNewChat}
              onSelect={handleSelectConversation}
              onRename={renameConversation}
              onDelete={handleDeleteConversation}
              onCollapse={() => setHistoryCollapsed(true)}
            />
          </aside>
        )}

        <section className="flex min-w-0 flex-1 flex-col bg-surface/40">
          <header className="flex items-center gap-3 border-b border-line bg-white px-3 py-2.5 lg:px-5">
            <button
              type="button"
              onClick={() => setHistoryOpen(true)}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-brand-50 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 lg:hidden"
              aria-label="Abrir historial de conversaciones"
            >
              <Icon name="menu" className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => setHistoryCollapsed((collapsed) => !collapsed)}
              aria-expanded={!historyCollapsed}
              aria-controls="assistant-history"
              aria-label={
                historyCollapsed
                  ? 'Mostrar conversaciones'
                  : 'Colapsar conversaciones'
              }
              title={
                historyCollapsed
                  ? 'Mostrar conversaciones'
                  : 'Colapsar conversaciones'
              }
              className="hidden h-8 w-8 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-brand-50 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 lg:grid"
            >
              <Icon
                name={historyCollapsed ? 'chevronRight' : 'chevronLeft'}
                className="h-4 w-4"
              />
            </button>

            <AssistantAvatar className="h-9 w-9" iconClassName="h-[18px] w-[18px]" />

            <div className="min-w-0">
              <h1 className="truncate text-[14px] font-semibold tracking-tight text-ink">
                Asistente Athenea
              </h1>
              <p className="flex items-center gap-1.5 text-[10px] text-muted">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                En línea · Respuestas con fuentes
              </p>
            </div>

            <div className="ml-auto flex items-center gap-1.5">
              {demoMode && (
                <span
                  title="Las respuestas se generan localmente hasta que el backend RAG esté disponible."
                  className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[9.5px] font-semibold text-amber-800"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  <span className="hidden sm:inline">Modo </span>Demo
                </span>
              )}
              <span className="hidden items-center gap-1 rounded-full border border-brand-100 bg-brand-50 px-2.5 py-1 text-[9.5px] font-medium text-brand-800 md:inline-flex">
                <Icon name="shield" className="h-3 w-3" />
                {roleLabel}
              </span>
              <span className="hidden items-center gap-1 rounded-full border border-line bg-white px-2.5 py-1 text-[9.5px] font-medium text-muted lg:inline-flex">
                <Icon name="stamp" className="h-3 w-3" />
                Solo lectura
              </span>
              <button
                type="button"
                onClick={() => setSourcesOpen((open) => !open)}
                aria-expanded={sourcesOpen}
                aria-controls="assistant-sources"
                aria-label={
                  sourcesOpen
                    ? 'Colapsar fuentes consultadas'
                    : 'Mostrar fuentes consultadas'
                }
                title={
                  sourcesOpen
                    ? 'Colapsar fuentes consultadas'
                    : 'Mostrar fuentes consultadas'
                }
                className={`hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9.5px] font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 xl:inline-flex ${
                  sourcesOpen
                    ? 'border-brand-200 bg-brand-50 text-brand-800'
                    : 'border-line bg-white text-muted hover:border-brand-200 hover:bg-brand-50 hover:text-brand-800'
                }`}
              >
                <Icon name="doc" className="h-3 w-3" />
                Fuentes
                {sourceCount > 0 && (
                  <span className="rounded-full bg-brand-100 px-1.5 text-[9px] font-bold text-brand-800">
                    {sourceCount}
                  </span>
                )}
              </button>
            </div>
          </header>

          <div className="flex items-start gap-2 border-b border-brand-100 bg-brand-50/60 px-3 py-2 text-[10px] leading-relaxed text-brand-900 lg:px-5">
            <Icon
              name="info"
              className="mt-px h-3.5 w-3.5 shrink-0 text-brand-600"
            />
            <p>
              <strong className="font-semibold">Respuesta informativa.</strong>{' '}
              Se genera solo con fragmentos autorizados y debe citar su fuente.
              No sustituye políticas institucionales ni dictámenes humanos.
            </p>
          </div>

          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
            {messages.length === 0 && !error ? (
              <Welcome
                roleLabel={roleLabel}
                onSelectPrompt={(prompt) => submitQuestion(prompt)}
              />
            ) : (
              <MessageList
                messages={messages}
                pending={pending}
                highlight={highlight}
                onCitationClick={handleCitationClick}
                onSelectPrompt={(prompt) => submitQuestion(prompt)}
              />
            )}

            {error && (
              <div className="mx-auto w-full max-w-3xl px-4 pb-6 lg:px-6">
                <div
                  role="alert"
                  className="flex flex-wrap items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5"
                >
                  <Icon
                    name="alert"
                    className="mt-0.5 h-4 w-4 shrink-0 text-red-600"
                  />
                  <p className="min-w-0 flex-1 text-[11px] leading-relaxed text-red-800">
                    {error}
                  </p>
                  {retryQuestion && (
                    <button
                      type="button"
                      onClick={handleRetry}
                      className="rounded-md border border-red-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-red-700 transition hover:bg-red-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
                    >
                      Reintentar
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <Composer
            value={draft}
            onChange={setDraft}
            onSubmit={() => submitQuestion(draft)}
            onStop={handleStop}
            pending={pending}
            textareaRef={textareaRef}
            roleLabel={roleLabel}
          />
        </section>

        {sourcesOpen ? (
          <SourcesPanel
            message={lastAssistantMessage}
            onClose={() => setSourcesOpen(false)}
          />
        ) : (
          <aside
            id="assistant-sources"
            aria-label="Fuentes consultadas (colapsadas)"
            className="hidden w-12 shrink-0 flex-col items-center border-l border-line bg-[#fbfcff] py-3 xl:flex"
          >
            <button
              type="button"
              onClick={() => setSourcesOpen(true)}
              aria-expanded={false}
              aria-controls="assistant-sources"
              aria-label="Mostrar fuentes consultadas"
              title="Mostrar fuentes consultadas"
              className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-white text-muted transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
            >
              <Icon name="doc" className="h-4 w-4" />
            </button>
            {sourceCount > 0 && (
              <span className="mt-1.5 rounded-full bg-brand-100 px-1.5 text-[9px] font-bold text-brand-800">
                {sourceCount}
              </span>
            )}
            <span className="mt-3 text-[9px] font-semibold uppercase tracking-[0.18em] text-muted [writing-mode:vertical-rl]">
              Fuentes
            </span>
          </aside>
        )}
      </div>

      {historyOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-ink/30 backdrop-blur-[1px]"
            aria-label="Cerrar historial de conversaciones"
            onClick={() => setHistoryOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <span className="text-sm font-semibold text-ink">
                Conversaciones
              </span>
              <button
                type="button"
                onClick={() => setHistoryOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-md text-muted transition hover:bg-brand-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
                aria-label="Cerrar historial"
              >
                <Icon name="close" className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <HistorySidebar
                conversations={conversations}
                activeId={activeId}
                searchQuery={searchQuery}
                onNewChat={handleNewChat}
                onSelect={handleSelectConversation}
                onRename={renameConversation}
                onDelete={handleDeleteConversation}
                onNavigate={() => setHistoryOpen(false)}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Welcome({
  roleLabel,
  onSelectPrompt,
}: {
  roleLabel: string;
  onSelectPrompt: (prompt: string) => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center px-4 py-8 text-center lg:px-6 lg:py-10">
      <AssistantAvatar className="h-12 w-12" iconClassName="h-6 w-6" />

      <h2 className="mt-3 text-lg font-semibold tracking-tight text-ink">
        ¿Qué necesitas consultar?
      </h2>
      <p className="mt-1.5 max-w-lg text-[12px] leading-relaxed text-muted">
        Pregunta en lenguaje natural sobre políticas, convocatorias, ética o el
        expediente de tus proyectos. Responderé solo con fragmentos autorizados
        y citaré cada fuente.
      </p>

      <div className="mt-4 flex flex-wrap justify-center gap-1.5 text-[9.5px] font-medium">
        <span className="inline-flex items-center gap-1 rounded-full border border-brand-100 bg-brand-50 px-2.5 py-1 text-brand-800">
          <Icon name="shield" className="h-3 w-3" />
          Contexto filtrado por rol
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-line bg-white px-2.5 py-1 text-muted">
          <Icon name="doc" className="h-3 w-3" />
          Citas verificables
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-line bg-white px-2.5 py-1 text-muted">
          <Icon name="stamp" className="h-3 w-3" />
          Solo lectura
        </span>
      </div>

      <div className="mt-6 grid w-full gap-2 sm:grid-cols-2">
        {SUGGESTED_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => onSelectPrompt(prompt)}
            className="group flex items-start gap-2 rounded-lg border border-line bg-white px-3 py-2.5 text-left text-[11px] leading-snug text-ink transition hover:border-brand-200 hover:bg-brand-50/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
          >
            <Icon
              name="spark"
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-500"
            />
            <span className="min-w-0 flex-1">{prompt}</span>
            <Icon
              name="arrowRight"
              className="mt-0.5 h-3 w-3 shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-brand-600"
            />
          </button>
        ))}
      </div>

      <p className="mt-4 text-[9.5px] leading-relaxed text-muted">
        Tu rol actual es <strong className="text-ink">{roleLabel}</strong>. El
        asistente filtra el contenido con tus permisos (AIR-004).
      </p>
    </div>
  );
}
