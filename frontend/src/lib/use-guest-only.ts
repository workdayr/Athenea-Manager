'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { authClient } from '@/lib/auth-client';

/**
 * Las pantallas de acceso no deben mostrarse a quien ya tiene sesión.
 * La comprobación es silenciosa: si falla, la pantalla sigue siendo usable.
 */
export function useGuestOnly(): void {
  const router = useRouter();

  useEffect(() => {
    let active = true;
    authClient
      .getSession()
      .then(({ data }) => {
        if (active && data?.user) {
          router.replace('/dashboard');
        }
      })
      .catch(() => {
        // Sin sesión verificable se permite el acceso normal al formulario.
      });
    return () => {
      active = false;
    };
  }, [router]);
}
