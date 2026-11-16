'use client';

import { useEffect, useState } from 'react';

/**
 * Mantiene un elemento montado mientras corre su animación de salida.
 *
 * Devuelve `true` mientras el overlay debe existir en el DOM: desde que
 * `open` pasa a `true` hasta que termina el cierre. Los cambios de estado
 * se programan en callbacks para no encadenar renders dentro del efecto.
 */
export function usePresence(open: boolean, exitMs = 200): boolean {
  const [mounted, setMounted] = useState(open);

  useEffect(() => {
    if (open) {
      const timer = window.setTimeout(() => setMounted(true), 0);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(() => setMounted(false), exitMs);
    return () => window.clearTimeout(timer);
  }, [open, exitMs]);

  return open || mounted;
}
