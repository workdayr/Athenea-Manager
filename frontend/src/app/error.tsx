'use client';

import { useEffect } from 'react';
import { ErrorState } from '@/components/ui/error-state';

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <ErrorState
        className="w-full max-w-md bg-white"
        title="Algo salió mal"
        description={
          error.message || 'Ocurrió un error inesperado. Inténtalo de nuevo.'
        }
        onRetry={retry}
      />
    </div>
  );
}
