import type { AssistantMessage } from '@/lib/assistant';
import { AssistantAvatar } from './assistant-avatar';
import { MessageBubble } from './message-bubble';

export function MessageList({
  messages,
  pending,
  highlight,
  onCitationClick,
  onSelectPrompt,
}: {
  messages: AssistantMessage[];
  pending: boolean;
  highlight: { messageId: string; index: number } | null;
  onCitationClick: (messageId: string, index: number) => void;
  onSelectPrompt: (prompt: string) => void;
}) {
  return (
    <div
      role="log"
      aria-live="polite"
      aria-relevant="additions"
      aria-label="Conversación con el asistente"
      className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 lg:px-6"
    >
      {messages.map((message) => (
        <MessageBubble
          key={message.id}
          message={message}
          highlight={highlight}
          onCitationClick={onCitationClick}
          onSelectPrompt={onSelectPrompt}
        />
      ))}
      {pending && <TypingIndicator />}
    </div>
  );
}

function TypingIndicator() {
  return (
    <article className="flex items-start gap-2.5">
      <AssistantAvatar className="mt-0.5 h-8 w-8" />
      <div className="rounded-2xl rounded-bl-md border border-line bg-white px-4 py-3 shadow-sm">
        <span className="flex gap-1.5" aria-hidden="true">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-400 [animation-delay:-0.3s] motion-reduce:animate-none" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-400 [animation-delay:-0.15s] motion-reduce:animate-none" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-400 motion-reduce:animate-none" />
        </span>
        <span className="sr-only">
          El asistente está buscando en documentos autorizados y redactando una
          respuesta.
        </span>
      </div>
    </article>
  );
}
