import type { ReactNode } from 'react';
import { ButtonLink } from './button';
import { EmptyState } from './empty-state';

/**
 * Bloqueo por permisos. No es un error del sistema: explica la regla de acceso
 * y ofrece una salida clara, sin pintar la pantalla de rojo.
 */
export function NoAccess({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-lg py-8">
      <EmptyState
        className="bg-white px-6 py-12"
        icon={
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
            <path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7" />
          </svg>
        }
        title={title}
        description={description}
        action={
          action ?? (
            <ButtonLink href="/dashboard" variant="secondary">
              Volver al panel
            </ButtonLink>
          )
        }
      />
    </div>
  );
}
