interface AuthClientError {
  status?: number;
  message?: string | null;
}

/**
 * Codigo ?error= que el backend usa cuando el correo no pertenece a un
 * dominio autorizado (ver UNAUTHORIZED_DOMAIN_ERROR_CODE en
 * backend/src/auth/auth.constants.ts). Debe mantenerse igual en ambos lados.
 */
export const UNAUTHORIZED_DOMAIN_ERROR_CODE = 'unauthorized_email_domain';

/**
 * Traduce el ?error= del callback OAuth (?error= + error_description) a un
 * mensaje fijo en espanol. Se prefieren mensajes fijos sobre
 * `error_description` porque el query viene de la URL (externo).
 */
export function mapOAuthCallbackError(
  oauthError: string | null,
  fallback = 'No fue posible continuar con Google. Intenta de nuevo o usa tu correo y contraseña.',
): string | null {
  if (!oauthError) {
    return null;
  }
  if (oauthError === UNAUTHORIZED_DOMAIN_ERROR_CODE) {
    return 'Este correo no pertenece a un dominio autorizado. Usa tu correo institucional @unipolidgo.edu.mx.';
  }
  return fallback;
}

/**
 * Traduce los errores del cliente BetterAuth a mensajes en espanol
 * para mostrar en la interfaz. Cuando el backend ya responde en
 * espanol (p. ej. dominio institucional, cuenta bloqueada) se usa
 * su mensaje tal cual.
 */
export function mapAuthError(
  error: AuthClientError | null | undefined,
  fallback: string,
): string {
  if (!error) {
    return fallback;
  }
  const serverMessage = error.message?.trim();
  // Los mensajes propios del backend ya vienen en espanol.
  if (serverMessage && /unipolidgo|bloqueada/i.test(serverMessage)) {
    return serverMessage;
  }
  switch (error.status) {
    case 400:
      return 'Revisa los datos ingresados e intenta de nuevo.';
    case 401:
      return 'Correo o contraseña incorrectos.';
    case 422:
      return 'Este correo no es válido o ya está registrado.';
    case 423:
      return 'Cuenta bloqueada temporalmente por múltiples intentos fallidos. Intenta de nuevo en 15 minutos.';
    case 429:
      return 'Demasiados intentos. Espera un momento e intenta de nuevo.';
    default:
      return fallback;
  }
}
