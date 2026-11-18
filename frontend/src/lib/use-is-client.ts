'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * `true` solo tras la hidratación. Permite renderizar portales sin provocar
 * desajustes entre el HTML del servidor y el primer render del cliente.
 */
export function useIsClient(): boolean {
  const subscribe = useCallback(() => () => {}, []);
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
