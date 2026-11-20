import { VerifyEmailForm } from './verify-email-form';

/**
 * Confirmacion de correo y reenvio del enlace.
 * El token y el estado llegan como query params; se leen en el servidor
 * y se pasan al formulario cliente.
 */
export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const token = typeof params.token === 'string' ? params.token : null;
  const email = typeof params.email === 'string' ? params.email : '';
  const verified = params.verified === '1';
  const error = typeof params.error === 'string' ? params.error : null;

  return (
    <VerifyEmailForm
      token={token}
      initialEmail={email}
      verified={verified}
      error={error}
    />
  );
}
