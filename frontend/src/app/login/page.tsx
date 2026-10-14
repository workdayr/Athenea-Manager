import { LoginForm } from './login-form';

/**
 * Pagina de login (RF-010, RF-015). Server Component: lee `?error=` del
 * callback OAuth en el servidor y lo pasa por props al formulario.
 * Asi el HTML del servidor y el primer render del cliente son identicos
 * (sin hydration mismatch), a diferencia de leer window.location en el
 * render del cliente.
 *
 * Acceder a `searchParams` vuelve la ruta dinamica (ƒ en el build), lo
 * cual es aceptable para una pagina de login.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const errorParam = params.error;
  const initialOAuthError =
    typeof errorParam === 'string' ? errorParam : null;

  return <LoginForm initialOAuthError={initialOAuthError} />;
}
