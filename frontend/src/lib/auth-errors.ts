interface AuthClientError {
  status?: number;
  message?: string | null;
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
