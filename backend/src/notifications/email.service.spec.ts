import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  EmailService,
  deliverEmail,
  loadEmailConfig,
  type EmailConfig,
} from './email.service.js';

const config: EmailConfig = {
  host: 'mailpit',
  port: 1025,
  secure: false,
  from: 'Athenea Manager <no-reply@athenea.local>',
};

const message = {
  to: 'pi@unipolidgo.edu.mx',
  subject: 'Decision del comite',
  text: 'Tu proyecto fue aprobado.',
};

afterEach(() => {
  delete process.env['SMTP_HOST'];
});

describe('loadEmailConfig (RF-014)', () => {
  it('sin SMTP_HOST devuelve null (fail-soft)', () => {
    expect(loadEmailConfig({})).toBeNull();
  });

  it('lee host, puerto, TLS y credenciales', () => {
    expect(
      loadEmailConfig({
        SMTP_HOST: 'mailpit',
        SMTP_PORT: '1025',
        SMTP_SECURE: 'true',
        SMTP_USER: 'athenea',
        SMTP_PASS: 'secret',
        SMTP_FROM: 'Athenea <no-reply@unipoli.edu.mx>',
      }),
    ).toEqual({
      host: 'mailpit',
      port: 1025,
      secure: true,
      user: 'athenea',
      pass: 'secret',
      from: 'Athenea <no-reply@unipoli.edu.mx>',
    });
  });
});

describe('deliverEmail (RF-014)', () => {
  it('omite el envio sin configuracion SMTP', async () => {
    await expect(deliverEmail(null, message)).resolves.toEqual({
      status: 'skipped',
      reason: 'SMTP no configurado.',
    });
  });

  it('envia con el transporter configurado', async () => {
    const sendMail = vi.fn().mockResolvedValue({ accepted: [message.to] });

    const result = await deliverEmail(config, message, () => ({
      sendMail,
    }) as never);

    expect(result).toEqual({ status: 'sent' });
    expect(sendMail).toHaveBeenCalledWith({
      from: config.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
    });
  });

  it('devuelve failed sin lanzar cuando SMTP falla', async () => {
    const result = await deliverEmail(config, message, () => ({
      sendMail: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    }) as never);

    expect(result).toEqual({ status: 'failed', error: 'ECONNREFUSED' });
  });
});

describe('EmailService (RF-014)', () => {
  it('sin SMTP configurado no intenta enviar', async () => {
    delete process.env['SMTP_HOST'];
    const service = new EmailService();

    expect(service.isConfigured()).toBe(false);
    await expect(service.send(message)).resolves.toEqual({
      status: 'skipped',
      reason: 'SMTP no configurado.',
    });
  });
});
