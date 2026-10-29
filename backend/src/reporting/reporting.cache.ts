import { DASHBOARD_CACHE_TTL_MS } from './reporting.constants.js';

export interface CacheEntry<T> {
  value: T;
  /** Momento en que se calculo el valor (epoch ms). */
  cachedAt: number;
  /** Momento en que la entrada deja de ser valida (epoch ms). */
  expiresAt: number;
}

export interface CacheResult<T> extends CacheEntry<T> {
  /** true si la respuesta se sirvio sin volver a calcular el valor. */
  fromCache: boolean;
}

/**
 * Cache TTL en memoria para el dashboard (RF-008).
 *
 * Se eligio memoria porque el backend es un unico deployable (monolito
 * modular) y no hay Redis en la arquitectura. El TTL se valida en el
 * constructor para que ninguna instancia pueda configurar una cache mas
 * longeva que el maximo de 15 minutos exigido.
 *
 * `getOrLoad` deduplica peticiones concurrentes: si dos usuarios piden el
 * mismo tablero mientras el primero sigue calculando, el segundo espera la
 * misma promesa en lugar de lanzar otra tanda de consultas.
 */
export class TtlCache<T> {
  private readonly entries = new Map<string, CacheEntry<T>>();
  private readonly pending = new Map<string, Promise<CacheEntry<T>>>();

  constructor(
    private readonly ttlMs: number = DASHBOARD_CACHE_TTL_MS,
    private readonly maxEntries: number = 100,
  ) {
    if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
      throw new Error('El TTL de la cache debe ser mayor que cero.');
    }
    if (ttlMs > DASHBOARD_CACHE_TTL_MS) {
      throw new Error(
        `El TTL de la cache no puede superar ${DASHBOARD_CACHE_TTL_MS} ms (15 min).`,
      );
    }
    if (!Number.isInteger(maxEntries) || maxEntries <= 0) {
      throw new Error('El maximo de entradas de cache debe ser un entero positivo.');
    }
  }

  get size(): number {
    return this.entries.size;
  }

  get(key: string, now: number = Date.now()): CacheEntry<T> | null {
    const entry = this.entries.get(key);
    if (!entry) {
      return null;
    }
    if (entry.expiresAt <= now) {
      this.entries.delete(key);
      return null;
    }
    return entry;
  }

  set(key: string, value: T, now: number = Date.now()): CacheEntry<T> {
    this.removeExpired(now);
    const entry: CacheEntry<T> = {
      value,
      cachedAt: now,
      expiresAt: now + this.ttlMs,
    };
    this.entries.set(key, entry);
    this.evictOverflow();
    return entry;
  }

  async getOrLoad(
    key: string,
    loader: () => Promise<T>,
    now: number = Date.now(),
  ): Promise<CacheResult<T>> {
    const hit = this.get(key, now);
    if (hit) {
      return { ...hit, fromCache: true };
    }

    const inFlight = this.pending.get(key);
    if (inFlight) {
      const entry = await inFlight;
      return { ...entry, fromCache: true };
    }

    const promise = loader()
      .then((value) => this.set(key, value))
      .finally(() => {
        this.pending.delete(key);
      });

    this.pending.set(key, promise);
    const entry = await promise;
    return { ...entry, fromCache: false };
  }

  clear(): void {
    this.entries.clear();
    this.pending.clear();
  }

  private removeExpired(now: number): void {
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) {
        this.entries.delete(key);
      }
    }
  }

  private evictOverflow(): void {
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) {
        return;
      }
      this.entries.delete(oldest);
    }
  }
}
