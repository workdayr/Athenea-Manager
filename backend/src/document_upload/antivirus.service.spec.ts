import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Socket } from 'net';
import { AntivirusService } from './antivirus.service.js';

/**
 * Crea un socket fake que simula clamd. Emite 'connect' inmediatamente y,
 * tras un retraso configurable, emite 'data' con la respuesta dada.
 */
function fakeClamdSocket(
  response: string,
  delayMs = 10,
  splitResponse = false,
): Socket & { write: ReturnType<typeof vi.fn> } {
  const socket = new Socket() as Socket & {
    write: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
    setTimeout: ReturnType<typeof vi.fn>;
    once: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
    emit: (...args: any[]) => boolean;
  };
  socket.write = vi.fn();
  socket.destroy = vi.fn();
  socket.setTimeout = vi.fn();
  let connectListener: (() => void) | null = null;
  let dataListener: ((chunk: Buffer) => void) | null = null;
  socket.once = vi.fn((event: string, listener: (...args: any[]) => void) => {
    if (event === 'connect') {
      connectListener = listener;
      setTimeout(() => connectListener?.(), delayMs);
    } else if (event === 'error') {
      (socket as any)._errorListener = listener;
    }
    return socket;
  });
  socket.on = vi.fn((event: string, listener: (...args: any[]) => void) => {
    if (event === 'data') {
      dataListener = listener;
    }
    return socket;
  });
  // Simula que clamd responde tras recibir la conexion
  setTimeout(() => {
    if (connectListener) {
      connectListener();
      setTimeout(() => {
        if (dataListener) {
          const text = response + '\n';
          if (splitResponse && text.length > 1) {
            const middle = Math.floor(text.length / 2);
            dataListener(Buffer.from(text.slice(0, middle)));
            dataListener(Buffer.from(text.slice(middle)));
          } else {
            dataListener(Buffer.from(text));
          }
        }
      }, delayMs);
    }
  }, delayMs);
  (socket as any).triggerError = () => {
    const listeners = (socket.once as any).mock.calls
      .filter(([e]) => e === 'error')
      .map(([, cb]) => cb);
    for (const cb of listeners) cb(new Error('ECONNREFUSED'));
  };
  return socket;
}

describe('AntivirusService (clamd INSTREAM)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('devuelve ok para un archivo limpio', async () => {
    const socket = fakeClamdSocket('stream: OK');
    const createConnection = vi.fn().mockReturnValue(socket);
    const av = new AntivirusService({
      host: '127.0.0.1',
      port: 3310,
      timeoutMs: 5000,
      createConnection,
    });
    const result = await av.scan(Buffer.from('contenido limpio'));
    expect(result).toBe('ok');
    expect(createConnection).toHaveBeenCalledWith({
      host: '127.0.0.1',
      port: 3310,
    });
    expect(socket.write).toHaveBeenCalledWith(
      expect.stringContaining('nINSTREAM'),
    );
  });

  it('envia el protocolo INSTREAM con bloques de tamano big-endian', async () => {
    const socket = fakeClamdSocket('stream: OK');
    const createConnection = vi.fn().mockReturnValue(socket);
    const av = new AntivirusService({
      createConnection,
    });
    const buf = Buffer.from('datos de prueba');
    await av.scan(buf);
    const writeCalls = socket.write.mock.calls.map((c) => c[0] as unknown);
    const headerIndex = writeCalls.indexOf('nINSTREAM\n');
    expect(headerIndex).toBeGreaterThanOrEqual(0);

    const sizePrefix = writeCalls[headerIndex + 1] as Buffer;
    expect(Buffer.isBuffer(sizePrefix)).toBe(true);
    expect(sizePrefix.length).toBe(4);
    expect(sizePrefix.readUInt32BE(0)).toBe(buf.length);

    expect(writeCalls[headerIndex + 2]).toBe(buf);
    expect(writeCalls[headerIndex + 3]).toEqual(Buffer.alloc(4)); // terminador
  });

  it('acepta una respuesta fragmentada en varios paquetes', async () => {
    const socket = fakeClamdSocket('stream: OK', 10, true);
    const createConnection = vi.fn().mockReturnValue(socket);
    const av = new AntivirusService({ createConnection });
    const result = await av.scan(Buffer.from('contenido limpio'));
    expect(result).toBe('ok');
  });

  it('usa CLAMAV_HOST/CLAMAV_PORT del entorno para la instancia por defecto', async () => {
    vi.stubEnv('CLAMAV_HOST', 'clamav-svc');
    vi.stubEnv('CLAMAV_PORT', '3399');
    vi.resetModules();
    const { antivirus } = await import('./antivirus.service.js');
    const instance = antivirus as unknown as { host: string; port: number };
    expect(instance.host).toBe('clamav-svc');
    expect(instance.port).toBe(3399);
    vi.unstubAllEnvs();
  });

  it('ignora un CLAMAV_PORT invalido de la instancia por defecto', async () => {
    vi.stubEnv('CLAMAV_PORT', 'no-es-un-puerto');
    vi.resetModules();
    const { antivirus } = await import('./antivirus.service.js');
    const instance = antivirus as unknown as { port: number };
    expect(instance.port).toBe(3310);
    vi.unstubAllEnvs();
  });

  it('usa ANTIVIRUS_TIMEOUT_MS del entorno para la instancia por defecto', async () => {
    vi.stubEnv('ANTIVIRUS_TIMEOUT_MS', '4500');
    vi.resetModules();
    const { antivirus } = await import('./antivirus.service.js');
    const instance = antivirus as unknown as { timeoutMs: number };
    expect(instance.timeoutMs).toBe(4500);
    vi.unstubAllEnvs();
  });

  it('ignora un ANTIVIRUS_TIMEOUT_MS invalido y conserva el valor por defecto', async () => {
    vi.stubEnv('ANTIVIRUS_TIMEOUT_MS', 'no-es-un-timeout');
    vi.resetModules();
    const { antivirus } = await import('./antivirus.service.js');
    const instance = antivirus as unknown as { timeoutMs: number };
    expect(instance.timeoutMs).toBe(30_000);
    vi.unstubAllEnvs();
  });

  it('devuelve infected para un archivo con firma de virus', async () => {
    const socket = fakeClamdSocket(
      'stream: test.file: Eicar-Test-Signature FOUND',
    );
    const createConnection = vi.fn().mockReturnValue(socket);
    const av = new AntivirusService({ createConnection });
    const result = await av.scan(
      Buffer.from('EICAR-STANDARD-ANTIVIRUS-TEST-FILE'),
    );
    expect(result).toBe('infected');
  });

  it('devuelve error de clamd como unavailable', async () => {
    const socket = fakeClamdSocket('stream: Error: clamd scan failed');
    const createConnection = vi.fn().mockReturnValue(socket);
    const av = new AntivirusService({ createConnection });
    const result = await av.scan(Buffer.from('cualquier cosa'));
    expect(result).toBe('unavailable');
  });

  it('devuelve unavailable si clamd no responde (timeout)', async () => {
    const socket = fakeClamdSocket('stream: OK', 5000); // responde despues del timeout
    const createConnection = vi.fn().mockReturnValue(socket);
    const av = new AntivirusService({
      createConnection,
      timeoutMs: 100,
    });
    const result = await av.scan(Buffer.from('cualquier cosa'));
    expect(result).toBe('unavailable');
  });

  it('devuelve unavailable si la conexion es rechazada', async () => {
    const socket = new Socket() as Socket & {
      once: ReturnType<typeof vi.fn>;
      on: ReturnType<typeof vi.fn>;
    };
    socket.once = vi.fn((event: string, listener: (...args: any[]) => void) => {
      if (event === 'error') {
        setTimeout(() => listener(new Error('ECONNREFUSED')), 10);
      }
      return socket;
    });
    socket.on = vi.fn();
    const createConnection = vi.fn().mockReturnValue(socket);
    const av = new AntivirusService({ createConnection, timeoutMs: 5000 });
    const result = await av.scan(Buffer.from('cualquier cosa'));
    expect(result).toBe('unavailable');
  });

  it('devuelve unavailable si createConnection lanza', async () => {
    const createConnection = vi.fn().mockImplementation(() => {
      throw new Error('no se puede crear socket');
    });
    const av = new AntivirusService({ createConnection, timeoutMs: 5000 });
    const result = await av.scan(Buffer.from('cualquier cosa'));
    expect(result).toBe('unavailable');
  });
});
