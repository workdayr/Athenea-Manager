'use client';

import { useCallback, useSyncExternalStore } from 'react';
import {
  conversationTitle,
  type AssistantConversation,
  type AssistantMessage,
} from './assistant';

/**
 * Historial local del asistente (RF-010 / UC-010).
 *
 * El backend aun no expone conversaciones, asi que se guardan en el
 * navegador con una clave versionada. La forma del dato coincide con el
 * contrato de `AssistantConversation`, de modo que pueda migrarse a una
 * consulta GraphQL sin cambiar los componentes.
 *
 * Se usa `useSyncExternalStore` para leer localStorage como fuente externa:
 * evita setState dentro de un efecto y sincroniza el historial entre
 * pestañas del mismo navegador.
 */

const STORAGE_KEY = 'athenea.assistant.conversations.v1';
const MAX_CONVERSATIONS = 20;
const MAX_MESSAGES_PER_CONVERSATION = 120;

const EMPTY_CONVERSATIONS: AssistantConversation[] = [];
const listeners = new Set<() => void>();
let cachedConversations: AssistantConversation[] | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isStoredMessage(value: unknown): value is AssistantMessage {
  if (!isRecord(value)) {
    return false;
  }
  const role = value.role;
  return (
    typeof value.id === 'string' &&
    (role === 'user' || role === 'assistant') &&
    typeof value.content === 'string' &&
    typeof value.createdAt === 'string' &&
    Array.isArray(value.citations)
  );
}

function sanitizeConversation(value: unknown): AssistantConversation | null {
  if (!isRecord(value)) {
    return null;
  }
  if (
    typeof value.id !== 'string' ||
    typeof value.title !== 'string' ||
    typeof value.createdAt !== 'string' ||
    typeof value.updatedAt !== 'string' ||
    !Array.isArray(value.messages)
  ) {
    return null;
  }

  return {
    id: value.id,
    title: value.title || 'Conversación',
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    messages: value.messages
      .filter(isStoredMessage)
      .slice(-MAX_MESSAGES_PER_CONVERSATION),
  };
}

function loadConversations(): AssistantConversation[] {
  if (typeof window === 'undefined') {
    return EMPTY_CONVERSATIONS;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return EMPTY_CONVERSATIONS;
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return EMPTY_CONVERSATIONS;
    }
    return parsed
      .map(sanitizeConversation)
      .filter((item): item is AssistantConversation => item !== null)
      .slice(0, MAX_CONVERSATIONS);
  } catch {
    return EMPTY_CONVERSATIONS;
  }
}

function persistConversations(conversations: AssistantConversation[]): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(conversations.slice(0, MAX_CONVERSATIONS)),
    );
  } catch {
    // Espacio agotado o almacenamiento bloqueado: la sesion sigue en memoria.
  }
}

function getSnapshot(): AssistantConversation[] {
  if (typeof window === 'undefined') {
    return EMPTY_CONVERSATIONS;
  }
  if (cachedConversations === null) {
    cachedConversations = loadConversations();
  }
  return cachedConversations;
}

function getServerSnapshot(): AssistantConversation[] {
  return EMPTY_CONVERSATIONS;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  function handleStorage(event: StorageEvent) {
    if (event.key === STORAGE_KEY) {
      cachedConversations = null;
      for (const current of listeners) {
        current();
      }
    }
  }

  window.addEventListener('storage', handleStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', handleStorage);
  };
}

function commitConversations(next: AssistantConversation[]): void {
  cachedConversations = next;
  persistConversations(next);
  for (const listener of listeners) {
    listener();
  }
}

export interface AssistantHistory {
  conversations: AssistantConversation[];
  createConversation: (firstMessage: AssistantMessage) => AssistantConversation;
  appendMessages: (conversationId: string, messages: AssistantMessage[]) => void;
  renameConversation: (conversationId: string, title: string) => void;
  deleteConversation: (conversationId: string) => void;
}

export function useAssistantHistory(): AssistantHistory {
  const conversations = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const createConversation = useCallback(
    (firstMessage: AssistantMessage): AssistantConversation => {
      const now = new Date().toISOString();
      const conversation: AssistantConversation = {
        id: `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title: conversationTitle(firstMessage.content),
        createdAt: now,
        updatedAt: now,
        messages: [firstMessage],
      };
      commitConversations(
        [conversation, ...getSnapshot()].slice(0, MAX_CONVERSATIONS),
      );
      return conversation;
    },
    [],
  );

  const appendMessages = useCallback(
    (conversationId: string, messages: AssistantMessage[]) => {
      const current = getSnapshot();
      const target = current.find(
        (conversation) => conversation.id === conversationId,
      );
      if (!target) {
        return;
      }
      const updated: AssistantConversation = {
        ...target,
        messages: [...target.messages, ...messages].slice(
          -MAX_MESSAGES_PER_CONVERSATION,
        ),
        updatedAt: new Date().toISOString(),
      };
      // La conversacion activa vuelve al inicio de la lista.
      commitConversations([
        updated,
        ...current.filter((item) => item.id !== conversationId),
      ]);
    },
    [],
  );

  const renameConversation = useCallback(
    (conversationId: string, title: string) => {
      const clean = title.replace(/\s+/g, ' ').trim();
      if (!clean) {
        return;
      }
      commitConversations(
        getSnapshot().map((conversation) =>
          conversation.id === conversationId
            ? {
                ...conversation,
                title: clean.slice(0, 80),
                updatedAt: new Date().toISOString(),
              }
            : conversation,
        ),
      );
    },
    [],
  );

  const deleteConversation = useCallback((conversationId: string) => {
    commitConversations(
      getSnapshot().filter(
        (conversation) => conversation.id !== conversationId,
      ),
    );
  }, []);

  return {
    conversations,
    createConversation,
    appendMessages,
    renameConversation,
    deleteConversation,
  };
}
