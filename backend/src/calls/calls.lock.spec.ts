import { describe, expect, it } from 'vitest';
import {
  enrollUnderRowLock,
  type CallSnapshot,
  type EnrollmentStore,
} from './calls.enrollment.js';
import { CALL_ERROR_CODES } from './calls.constants.js';

const FUTURE = new Date('2026-12-31T23:59:59Z');
const NOW = new Date('2026-06-01T12:00:00Z');

/**
 * Doble de la fila Announcement que replica la semantica de
 * `SELECT ... FOR UPDATE`: la primera transaccion que lee adquiere el
 * bloqueo y lo conserva hasta escribir (markClosed/incrementCount).
 * Las demas esperan su turno: el tramo leer-validar-escribir es serial.
 */
class RowLockDb implements EnrollmentStore {
  sql: string[] = [];
  private locked = false;
  private waiters: Array<() => void> = [];
  private seq = 0;

  constructor(
    private state: {
      exists: boolean;
      status: string;
      deadline: Date;
      cap: number;
      count: number;
    } = { exists: true, status: 'OPEN', deadline: FUTURE, cap: 5, count: 0 },
  ) {}

  private async acquire(): Promise<void> {
    if (!this.locked) {
      this.locked = true;
      return;
    }
    await new Promise<void>((resolve) => {
      this.waiters.push(resolve);
    });
  }

  private release(): void {
    const next = this.waiters.shift();
    if (next) next();
    else this.locked = false;
  }

  private snapshot(): CallSnapshot {
    return {
      call_id: 1,
      status: this.state.status,
      deadline: this.state.deadline,
      application_cap: this.state.cap,
      application_count: this.state.count,
    };
  }

  async queryCallForUpdate(): Promise<CallSnapshot | null> {
    this.sql.push(
      'SELECT "call_id", "status", "deadline", "application_cap", "application_count" FROM "Announcement" WHERE "call_id" = $1 FOR UPDATE',
    );
    if (!this.state.exists) return null;
    await this.acquire();
    // Rutas que no escriben liberan de inmediato (en Postgres real el
    // bloqueo se libera con el rollback/abort de la transaccion).
    if (this.state.status !== 'OPEN') this.release();
    return this.snapshot();
  }

  async markClosed(): Promise<void> {
    this.state.status = 'CLOSED';
    this.release();
  }

  async incrementCount(): Promise<CallSnapshot> {
    this.state.count += 1;
    if (this.state.count >= this.state.cap) this.state.status = 'CLOSED';
    this.release();
    return this.snapshot();
  }

  async createProject(): Promise<{ id: number }> {
    this.seq += 1;
    return { id: this.seq };
  }

  get count(): number {
    return this.state.count;
  }

  get status(): string {
    return this.state.status;
  }
}

describe('cierre por cupo con row-level locking (RF-018)', () => {
  it('20 postulaciones concurrentes con cupo 5: entran 5, 15 son rechazadas', async () => {
    const db = new RowLockDb();
    const attempts = await Promise.allSettled(
      Array.from({ length: 20 }, () =>
        enrollUnderRowLock(db, 1, NOW, () => db.createProject()),
      ),
    );
    const ok = attempts.filter((r) => r.status === 'fulfilled');
    const rejected = attempts.filter((r) => r.status === 'rejected');

    expect(ok).toHaveLength(5);
    expect(rejected).toHaveLength(15);
    for (const r of rejected) {
      // CALL_FULL si alcanzo a ver OPEN+lleno, CALL_CLOSED si ya se marco
      // CLOSED. Ambos significan "cupo impuesto": nada entra de mas.
      expect(['CALL_FULL', 'CALL_CLOSED']).toContain(
        (r as PromiseRejectedResult).reason.code,
      );
    }
    // El cupo jamas se excede y la convocatoria queda cerrada.
    expect(db.count).toBe(5);
    expect(db.status).toBe('CLOSED');
    // Cada intento bloqueo la fila antes de leer.
    expect(db.sql).toHaveLength(20);
    expect(db.sql[0]).toContain('FOR UPDATE');
  });

  it('cierra por deadline y no crea el proyecto', async () => {
    const db = new RowLockDb({
      exists: true,
      status: 'OPEN',
      deadline: new Date('2026-01-01'),
      cap: 5,
      count: 0,
    });
    await expect(
      enrollUnderRowLock(db, 1, NOW, () => db.createProject()),
    ).rejects.toMatchObject({ code: CALL_ERROR_CODES.CALL_CLOSED });
    expect(db.status).toBe('CLOSED');
    expect(db.count).toBe(0);
  });

  it('rechaza convocatorias no abiertas (DRAFT/CLOSED)', async () => {
    const db = new RowLockDb({
      exists: true,
      status: 'DRAFT',
      deadline: FUTURE,
      cap: 5,
      count: 0,
    });
    await expect(
      enrollUnderRowLock(db, 1, NOW, () => db.createProject()),
    ).rejects.toMatchObject({ code: CALL_ERROR_CODES.CALL_CLOSED });
    expect(db.count).toBe(0);
  });
});

describe('sin bloqueo la carrera excede el cupo (motiva FOR UPDATE)', () => {
  it('dos transacciones que leen 4/5 antes de escribir dejan 6/5', () => {
    // Intercalado real sin lock: T1 lee, T2 lee, T1 escribe, T2 escribe.
    const store = { count: 4, cap: 5 };
    const seenByT1 = store.count; // 4 < 5: pasa la validacion
    const seenByT2 = store.count; // 4 < 5: pasa la validacion
    if (seenByT1 < store.cap) store.count += 1; // 5
    if (seenByT2 < store.cap) store.count += 1; // 6: overbooking
    expect(store.count).toBe(6);
    expect(store.count).toBeGreaterThan(store.cap);
  });
});
