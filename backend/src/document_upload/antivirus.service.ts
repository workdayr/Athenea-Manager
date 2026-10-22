/**
 * Cliente de escaneo antivirus via protocolo clamd INSTREAM (ClamAV).
 * Implementa el puerto de escaneo del modulo document_upload.
 *
 * Protocolo clamd (resumido):
 *   CONECTAR a clamd:3310
 *   Enviar: `nINSTREAM\n` (n = sin compresion) seguido de uno o mas bloques
 *     `<uint32 BE con el tamano del bloque><bytes del bloque>`, terminando
 *     con un bloque de tamano cero (`\x00\x00\x00\x00`). El tamano va en
 *     orden de bytes de red (big-endian), NO como texto.
 *   Leer respuesta hasta `\n`:
 *     `stream: OK`                  -> archivo limpio
 *     `stream: <archivo>: <virus> FOUND` -> infectado
 *     `stream: Error: ...`          -> error del scanner
 *
 * F-05 (arquitectura): si el scanner tarda mas del timeout o no responde,
 * la subida se RECHAZA con 503 y nada se guarda (fail closed).
 *
 * `createConnection` se inyecta para poder testear sin un servidor ClamAV real.
 */

import { createConnection as realCreateConnection, Socket } from 'net';

export type ScanResult = 'ok' | 'infected' | 'unavailable';

const DEFAULT_CLAMAV_HOST = 'localhost';
const DEFAULT_CLAMAV_PORT = 3310;
const DEFAULT_TIMEOUT_MS = 30_000;

interface AntivirusOptions {
  host?: string;
  port?: number;
  timeoutMs?: number;
  // Dependencia inyectable (tests): factory que devuelve un Socket-like.
  createConnection?: typeof realCreateConnection;
}

export class AntivirusService {
  private readonly host: string;
  private readonly port: number;
  private readonly timeoutMs: number;
  private readonly createConnection: typeof realCreateConnection;

  constructor(options: AntivirusOptions = {}) {
    this.host = options.host ?? DEFAULT_CLAMAV_HOST;
    this.port = options.port ?? DEFAULT_CLAMAV_PORT;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.createConnection = options.createConnection ?? realCreateConnection;
  }

  /**
   * Escanea un buffer. Devuelve 'ok' si esta limpio, 'infected' si clamd
   * reporta un virus, o 'unavailable' si no se puede contactar al scanner
   * o excede el timeout (F-05: fail closed).
   */
  async scan(buffer: Buffer): Promise<ScanResult> {
    return new Promise((resolve) => {
      let socket: Socket | null = null;
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        socket?.destroy();
        resolve('unavailable');
      }, this.timeoutMs);

      const cleanup = () => {
        clearTimeout(timer);
        socket?.destroy();
        socket = null;
      };

      try {
        socket = this.createConnection({
          host: this.host,
          port: this.port,
        });
      } catch {
        cleanup();
        resolve('unavailable');
        return;
      }

      socket.setTimeout(this.timeoutMs);

      socket.once('connect', () => {
        // Protocolo INSTREAM: `nINSTREAM\n` + bloques de 4 bytes BE (tamano)
        // + datos, terminados por un bloque de tamano cero.
        socket!.write('nINSTREAM\n');
        const size = Buffer.alloc(4);
        size.writeUInt32BE(buffer.length, 0);
        socket!.write(size);
        socket!.write(buffer);
        socket!.write(Buffer.alloc(4)); // terminador: bloque de tamano 0
      });

      // clamd puede fragmentar la respuesta en varios paquetes TCP: acumular
      // hasta tener la linea completa antes de decidir.
      let response = '';
      socket.on('data', (chunk: Buffer) => {
        if (settled) return;
        response += chunk.toString('latin1');
        const newline = response.indexOf('\n');
        if (newline === -1) return;
        const line = response.slice(0, newline).trim();
        if (!line) return;
        settled = true;
        cleanup();
        if (line.startsWith('stream: OK')) {
          resolve('ok');
        } else if (line.includes(' FOUND')) {
          resolve('infected');
        } else {
          resolve('unavailable');
        }
      });

      socket.once('error', () => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve('unavailable');
      });

      socket.once('timeout', () => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve('unavailable');
      });

      socket.once('close', () => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve('unavailable');
      });
    });
  }
}

/** Lee un puerto valido de entorno o usa el valor por defecto. */
function envPort(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 65535
    ? parsed
    : fallback;
}

/**
 * Instancia por defecto. El host/puerto se toman de `CLAMAV_HOST` /
 * `CLAMAV_PORT` (documentados en `.env.example`); en Docker Compose el
 * backend debe apuntar al servicio `clamav` (`CLAMAV_HOST=clamav`), porque
 * `localhost` dentro del contenedor no es el daemon.
 */
export const antivirus = new AntivirusService({
  host: process.env['CLAMAV_HOST'] || DEFAULT_CLAMAV_HOST,
  port: envPort(process.env['CLAMAV_PORT'], DEFAULT_CLAMAV_PORT),
});
