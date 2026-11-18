import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="w-full max-w-md space-y-3" aria-busy="true">
        <span className="sr-only">Cargando Athenea Manager…</span>
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
        <Skeleton className="mt-4 h-40 w-full rounded-xl" />
      </div>
    </div>
  );
}
