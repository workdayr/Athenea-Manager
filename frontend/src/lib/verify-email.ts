/**
 * Enlace de confirmacion.
 *
 * BetterAuth expone `GET /api/auth/verify-email?token=...&callbackURL=...`
 * como redireccion top-level. Se usa el proxy same-origin de Next para que
 * el navegador nunca hable directo con el backend y el `callbackURL`
 * relativo regrese a la pagina del frontend.
 */
export function verificationConfirmationHref(token: string): string {
  const callback = encodeURIComponent('/verify-email?verified=1');
  return `/api/auth/verify-email?token=${encodeURIComponent(token)}&callbackURL=${callback}`;
}
