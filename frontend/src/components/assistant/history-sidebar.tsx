'use client';

import { useMemo, useRef, useState, type FormEvent } from 'react';
import { Icon } from '@/components/dashboard/icons';
import {
  formatConversationTime,
  type AssistantConversation,
} from '@/lib/assistant';

export function HistorySidebar({
  conversations,
  activeId,
  searchQuery,
  onNewChat,
  onSelect,
  onRename,
  onDelete,
  onNavigate,
  onCollapse,
}: {
  conversations: AssistantConversation[];
  activeId: string | null;
  searchQuery: string;
  onNewChat: () => void;
  onSelect: (conversationId: string) => void;
  onRename: (conversationId: string, title: string) => void;
  onDelete: (conversationId: string) => void;
  onNavigate?: () => void;
  onCollapse?: () => void;
}) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const cancelRenameRef = useRef(false);

  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase('es');
    if (!query) {
      return conversations;
    }
    return conversations.filter(
      (conversation) =>
        conversation.id === activeId ||
        conversation.title.toLocaleLowerCase('es').includes(query),
    );
  }, [conversations, searchQuery, activeId]);

  function startRename(conversation: AssistantConversation) {
    cancelRenameRef.current = false;
    setRenamingId(conversation.id);
    setRenameValue(conversation.title);
    setDeletingId(null);
  }

  function commitRename() {
    if (!renamingId) {
      return;
    }
    if (cancelRenameRef.current) {
      cancelRenameRef.current = false;
      setRenamingId(null);
      return;
    }
    onRename(renamingId, renameValue);
    setRenamingId(null);
  }

  function handleRenameSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    commitRename();
  }

  function cancelRename() {
    cancelRenameRef.current = true;
    setRenamingId(null);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-line px-3 py-3">
        <div className="flex items-center justify-between gap-2 px-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
            Conversaciones
          </p>
          {onCollapse && (
            <button
              type="button"
              onClick={onCollapse}
              aria-label="Colapsar conversaciones"
              title="Colapsar conversaciones"
              className="grid h-6 w-6 shrink-0 place-items-center rounded text-muted transition hover:bg-white hover:text-brand-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
            >
              <Icon name="chevronLeft" className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={onNewChat}
          className={`mt-2 flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-[12px] font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 ${
            activeId === null
              ? 'border-brand-200 bg-brand-50 text-brand-900'
              : 'border-dashed border-line text-muted hover:border-brand-200 hover:bg-brand-50/60 hover:text-ink'
          }`}
        >
          <Icon name="plus" className="h-4 w-4" />
          Nueva conversación
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
        {conversations.length === 0 ? (
          <div className="px-2 py-6 text-center">
            <Icon
              name="history"
              className="mx-auto h-5 w-5 text-muted/60"
            />
            <p className="mt-2 text-[11px] font-medium text-ink">
              Aún no hay conversaciones
            </p>
            <p className="mt-1 text-[10px] leading-relaxed text-muted">
              Tus consultas se guardarán en este navegador.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <p className="px-2 py-6 text-center text-[10.5px] leading-relaxed text-muted">
            No hay conversaciones que coincidan con «{searchQuery.trim()}».
          </p>
        ) : (
          <ul className="space-y-1">
            {filtered.map((conversation) => {
              const isActive = conversation.id === activeId;
              const count = conversation.messages.length;
              return (
                <li
                  key={conversation.id}
                  className={`group rounded-lg border transition ${
                    isActive
                      ? 'border-brand-200 bg-brand-50/80'
                      : 'border-transparent hover:bg-[#f6f8fd]'
                  }`}
                >
                  <div className="flex items-start gap-1 px-2 py-2">
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(conversation.id);
                        onNavigate?.();
                      }}
                      aria-current={isActive ? 'true' : undefined}
                      className="min-w-0 flex-1 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
                    >
                      <span
                        className={`block truncate text-[12px] font-medium ${
                          isActive ? 'text-brand-900' : 'text-ink'
                        }`}
                      >
                        {conversation.title}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1 text-[9.5px] text-muted">
                        <Icon name="clock" className="h-3 w-3" />
                        {formatConversationTime(conversation.updatedAt)}
                        <span aria-hidden="true">·</span>
                        {count} {count === 1 ? 'mensaje' : 'mensajes'}
                      </span>
                    </button>

                    <div className="flex shrink-0 items-center gap-0.5 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100">
                      <button
                        type="button"
                        onClick={() => startRename(conversation)}
                        aria-label={`Renombrar ${conversation.title}`}
                        title="Renombrar"
                        className="grid h-6 w-6 place-items-center rounded text-muted transition hover:bg-white hover:text-brand-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
                      >
                        <Icon name="pencil" className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDeletingId(conversation.id);
                          setRenamingId(null);
                        }}
                        aria-label={`Eliminar ${conversation.title}`}
                        title="Eliminar"
                        className="grid h-6 w-6 place-items-center rounded text-muted transition hover:bg-red-50 hover:text-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
                      >
                        <Icon name="trash" className="h-3 w-3" />
                      </button>
                    </div>
                  </div>

                  {renamingId === conversation.id && (
                    <form
                      onSubmit={handleRenameSubmit}
                      className="border-t border-brand-100 px-2 py-2"
                    >
                      <label
                        htmlFor={`rename-${conversation.id}`}
                        className="sr-only"
                      >
                        Nuevo título de la conversación
                      </label>
                      <input
                        id={`rename-${conversation.id}`}
                        autoFocus
                        value={renameValue}
                        maxLength={80}
                        onChange={(event) => setRenameValue(event.target.value)}
                        onBlur={commitRename}
                        onKeyDown={(event) => {
                          if (event.key === 'Escape') {
                            cancelRename();
                          }
                        }}
                        className="h-7 w-full rounded border border-brand-200 bg-white px-2 text-[11px] text-ink focus:border-brand-400 focus:outline-none"
                      />
                    </form>
                  )}

                  {deletingId === conversation.id && (
                    <div className="border-t border-line px-2 py-2">
                      <p className="text-[9.5px] leading-snug text-muted">
                        ¿Eliminar esta conversación?
                      </p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            onDelete(conversation.id);
                            setDeletingId(null);
                          }}
                          className="rounded bg-red-600 px-2 py-1 text-[9.5px] font-semibold text-white hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
                        >
                          Eliminar
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingId(null)}
                          className="rounded px-1.5 py-1 text-[9.5px] font-medium text-muted hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="border-t border-line px-3 py-3">
        <p className="flex items-start gap-1.5 text-[9.5px] leading-relaxed text-muted">
          <Icon name="shield" className="mt-px h-3 w-3 shrink-0 text-brand-600" />
          El historial se guarda solo en este navegador.
        </p>
      </div>
    </div>
  );
}
