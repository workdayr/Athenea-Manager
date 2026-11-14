import { ResetPasswordForm } from './reset-password-form';

/**
 * F1-06 / RF-010: la pagina lee el token del enlace del correo en el
 * servidor y lo pasa al formulario. Asi no hay hydration mismatch ni
 * `useSearchParams` en un componente cliente.
 */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const token = typeof params.token === 'string' ? params.token : null;
  const error =
    typeof params.error === 'string' ? params.error : null;

  return <ResetPasswordForm token={token} initialError={error} />;
}
