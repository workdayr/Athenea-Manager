import { Injectable, Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from: string;
}

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

export type EmailSendResult =
  | { status: 'sent' }
  | { status: 'skipped'; reason: string }
  | { status: 'failed'; error: string };

const DEFAULT_SMTP_PORT = 1025;
const DEFAULT_FROM = 'Athenea Manager <no-reply@athenea.local>';

function isTruthy(value: string | undefined): boolean {
  if (!value) {
    return false;
  }
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * RF-014: configuracion SMTP opcional. Sin `SMTP_HOST` el sistema funciona
 * en modo fail-soft: la notificacion in-app se persiste y el correo queda
 * marcado como `Skipped`.
 */
export function loadEmailConfig(
  env: NodeJS.ProcessEnv = process.env,
): EmailConfig | null {
  const host = env['SMTP_HOST']?.trim();
  if (!host) {
    return null;
  }
  const parsedPort = Number(env['SMTP_PORT'] ?? DEFAULT_SMTP_PORT);
  const port =
    Number.isFinite(parsedPort) && parsedPort > 0
      ? Math.trunc(parsedPort)
      : DEFAULT_SMTP_PORT;
  const user = env['SMTP_USER']?.trim();
  const pass = env['SMTP_PASS'];
  return {
    host,
    port,
    secure: isTruthy(env['SMTP_SECURE']),
    user: user || undefined,
    pass: pass || undefined,
    from: env['SMTP_FROM']?.trim() || DEFAULT_FROM,
  };
}

/** Envia un correo con la configuracion dada; nunca lanza. */
export async function deliverEmail(
  config: EmailConfig | null,
  message: EmailMessage,
  transportFactory: (config: EmailConfig) => Transporter = defaultTransport,
): Promise<EmailSendResult> {
  if (!config) {
    return { status: 'skipped', reason: 'SMTP no configurado.' };
  }
  try {
    const transporter = transportFactory(config);
    await transporter.sendMail({
      from: config.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
    });
    return { status: 'sent' };
  } catch (error) {
    return { status: 'failed', error: errorMessage(error) };
  }
}

function defaultTransport(config: EmailConfig): Transporter {
  return createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth:
      config.user && config.pass
        ? { user: config.user, pass: config.pass }
        : undefined,
  });
}

/**
 * Servicio de correo de produccion. Mantiene un unico transporter por
 * proceso; el job de outbox lo reutiliza entre lotes.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly config = loadEmailConfig();
  private transporter: Transporter | null = null;

  isConfigured(): boolean {
    return this.config !== null;
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    if (!this.config) {
      this.logger.debug(
        `SMTP no configurado; correo omitido para ${message.to}.`,
      );
      return { status: 'skipped', reason: 'SMTP no configurado.' };
    }
    try {
      this.transporter ??= defaultTransport(this.config);
      await this.transporter.sendMail({
        from: this.config.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
      });
      return { status: 'sent' };
    } catch (error) {
      return { status: 'failed', error: errorMessage(error) };
    }
  }
}
