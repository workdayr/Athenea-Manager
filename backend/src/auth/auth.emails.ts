import { Logger } from '@nestjs/common';
import { EmailService } from '../notifications/email.service.js';

/**
 * F1-06 / RF-010: plantillas y envio de los correos de verificacion de
 * cuenta y recuperacion de contrasena.
 *
 * Reutiliza `EmailService` (F1-01): si SMTP no esta configurado el envio
 * es fail-soft y el enlace queda en el log para desarrollo. Nunca lanza:
 * un fallo de correo no debe romper el registro ni el reset.
 */

const logger = new Logger('AuthEmails');

/** Un unico transporter por proceso, compartido con el resto de correos. */
const mailer = new EmailService();

const DEFAULT_FRONTEND_ORIGIN = 'http://localhost:3000';

/** Origen del frontend sin barra final, para construir enlaces absolutos. */
export function frontendOrigin(
  env: NodeJS.ProcessEnv = process.env,
): string {
  return (env['FRONTEND_ORIGIN'] ?? DEFAULT_FRONTEND_ORIGIN).replace(
    /\/+$/,
    '',
  );
}

export interface AuthEmailContent {
  subject: string;
  text: string;
}

export function buildVerificationEmail(
  name: string,
  url: string,
): AuthEmailContent {
  return {
    subject: 'Verifica tu correo — Athenea Manager',
    text: [
      `Hola ${name}:`,
      '',
      'Recibimos una solicitud para verificar el correo de tu cuenta en Athenea Manager.',
      'Confirma tu direccion abriendo el siguiente enlace:',
      '',
      url,
      '',
      'El enlace expira en 24 horas. Si no creaste esta cuenta, ignora este mensaje.',
      '',
      'Athenea Manager — Universidad Politecnica de Durango',
    ].join('\n'),
  };
}

export function buildPasswordResetEmail(
  name: string,
  url: string,
): AuthEmailContent {
  return {
    subject: 'Recupera tu contrasena — Athenea Manager',
    text: [
      `Hola ${name}:`,
      '',
      'Recibimos una solicitud para restablecer la contrasena de tu cuenta.',
      'Abre el siguiente enlace para elegir una nueva contrasena:',
      '',
      url,
      '',
      'El enlace expira en 30 minutos y solo puede usarse una vez.',
      'Si no solicitaste el cambio, ignora este mensaje: tu contrasena actual sigue vigente.',
      '',
      'Athenea Manager — Universidad Politecnica de Durango',
    ].join('\n'),
  };
}

/** Enlace de verificacion que apunta a la pagina del frontend. */
export function verificationUrl(token: string): string {
  return `${frontendOrigin()}/verify-email?token=${encodeURIComponent(token)}`;
}

/** Enlace de recuperacion que apunta a la pagina del frontend. */
export function passwordResetUrl(token: string): string {
  return `${frontendOrigin()}/reset-password?token=${encodeURIComponent(token)}`;
}

async function deliver(
  to: string,
  content: AuthEmailContent,
  fallbackLink: string,
): Promise<void> {
  const result = await mailer.send({ to, ...content });
  if (result.status === 'sent') {
    return;
  }
  if (result.status === 'skipped') {
    // Desarrollo sin SMTP: el enlace ya esta en el cuerpo del correo.
    logger.warn(
      `SMTP no configurado. Enlace para ${to}:\n${fallbackLink}`,
    );
  } else {
    logger.error(`No se pudo enviar el correo a ${to}: ${result.error}`);
  }
}

export async function sendVerificationEmail(
  user: { name: string; email: string },
  token: string,
): Promise<void> {
  const url = verificationUrl(token);
  await deliver(user.email, buildVerificationEmail(user.name, url), url);
}

export async function sendPasswordResetEmail(
  user: { name: string; email: string },
  token: string,
): Promise<void> {
  const url = passwordResetUrl(token);
  await deliver(user.email, buildPasswordResetEmail(user.name, url), url);
}
