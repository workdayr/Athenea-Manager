'use client';

import { AuthedShell } from '@/components/dashboard/authed-shell';
import { AssistantChat } from '@/components/assistant/assistant-chat';
import { useState } from 'react';
import type { DashboardUser } from '@/lib/dashboard';

/**
 * US Asistente Virtual RAG.
 *
 * Cualquier usuario autenticado puede consultar politicas institucionales
 * en lenguaje natural. La respuesta se limita a fragmentos autorizados y
 * siempre muestra citas enlazadas al documento original.
 */
export default function AssistantPage() {
  const [query, setQuery] = useState('');

  return (
    <AuthedShell
      activeId="rag"
      searchPlaceholder="Buscar en tus conversaciones…"
      searchQuery={query}
      onSearchChange={setQuery}
    >
      {(user: DashboardUser) => <AssistantChat user={user} searchQuery={query} />}
    </AuthedShell>
  );
}
