import type { BetterAuthOptions } from 'better-auth';
import { APIError, createAuthMiddleware, isAPIError } from 'better-auth/api';
import { bearer } from 'better-auth/plugins';
import bcrypt from 'bcryptjs';
import {
  ACCOUNT_LOCKOUT_MINUTES,
  BCRYPT_COST_FACTOR,
  DEFAULT_USER_ROLE,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  UNAUTHORIZED_DOMAIN_ERROR_CODE,
} from './auth.constants.js';
import {
  evaluateLockout,
  getAuthorizedEmailDomains,
  isAuthorizedEmail,
  nextStateAfterFailure,
  nextStateAfterSuccess,
  unauthorizedDomainMessage,
  type LockoutState,
} from './auth.policy.js';

/** Campos de bloqueo leidos de la fila del usuario (additionalFields). */
interface UserLockoutRow extends LockoutState {
  id: string;
}

const SIGN_UP_EMAIL_PATH = '/sign-up/email';
const SIGN_IN_EMAIL_PATH = '/sign-in/email';

/**
 * Construye las opciones de BetterAuth de forma reutilizable:
 * produccion inyecta el adapter de Prisma y los tests el adapter de memoria.
 */
export function buildAuthOptions(
  database: BetterAuthOptions['database'],
): BetterAuthOptions {
  // RF-015: OAuth con Google Workspace. Solo se configura si hay
  // credenciales (sin ellas el endpoint responde PROVIDER_NOT_FOUND).
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

  return {
    appName: 'Athenea Manager',
    // URL base explicita (recomendado por BetterAuth; tambien se lee de
    // BETTER_AUTH_URL). Requerida para callbacks y validacion de origen.
    baseURL: process.env.BETTER_AUTH_URL,
    database,
    // Origenes de confianza para el chequeo CSRF de BetterAuth. El proxy
    // de Next reenvia el header `Origin` del navegador, asi que se aceptan
    // localhost y 127.0.0.1 (el usuario puede abrir el frontend con
    // cualquiera de los dos) mas el configurado por entorno.
    trustedOrigins: [
      ...new Set([
        process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000',
        'http://localhost:3000',
        'http://127.0.0.1:3000',
      ]),
    ],
    emailAndPassword: {
      enabled: true,
      // La verificacion de correo se anade en una tarea posterior (fuera de alcance).
      requireEmailVerification: false,
      autoSignIn: true,
      minPasswordLength: MIN_PASSWORD_LENGTH,
      maxPasswordLength: MAX_PASSWORD_LENGTH,
      password: {
        // RF-010 / RNF-006: bcrypt con cost factor 12.
        hash: (password: string) =>
          bcrypt.hash(password, BCRYPT_COST_FACTOR),
        verify: ({ hash, password }: { hash: string; password: string }) =>
          bcrypt.compare(password, hash),
      },
    },
    // RF-015: login con Google Workspace. Se pasa el objeto de opciones
    // crudo (NO la factoria `google()`): BetterAuth 1.7 construye el
    // proveedor internamente desde `socialProviders.<id>`.
    // El callback del proveedor es `${baseURL}/api/auth/callback/google`
    // (navegacion top-level, sin CORS).
    // NOTA: no se usa la opcion `hd` del proveedor porque rechazaria los
    // dominios externos autorizados de RF-015; la politica de dominios se
    // aplica en `databaseHooks` (abajo) y en el hook de registro.
    socialProviders:
      googleClientId && googleClientSecret
        ? {
            google: {
              clientId: googleClientId,
              clientSecret: googleClientSecret,
            },
          }
        : {},
    account: {
      // RF-015: vinculacion silenciosa ACTIVADA. Si el email de Google
      // coincide con un usuario existente, la cuenta OAuth se vincula sola
      // y entra directo al dashboard, sin pedir la contrasena.
      // `allowDifferentEmails` queda en false (default): solo se vincula
      // con el MISMO email. `trustedProviders` declara a Google como
      // proveedor confiable.
      // `requireLocalEmailVerified: false`: BetterAuth exige por defecto
      // que el usuario LOCAL tenga el correo verificado antes de vincular
      // OAuth. Como no hay flujo de verificacion de correo, ese flag es
      // false en todos los registros por formulario y bloqueaba el login
      // con Google (`account_not_linked`). Google Workspace verifica el
      // correo en su lado (emailVerified desde el ID token) y el dominio
      // institucional ya restringe el registro, por lo que el requisito
      // local se relaja. La politica de dominios sigue aplicandose en
      // `databaseHooks` (correos no autorizados -> 422 en el callback).
      accountLinking: {
        enabled: true,
        trustedProviders: ['google'],
        requireLocalEmailVerified: false,
      },
    },
    // BR-005 + RF-015 en la creacion de usuarios por CUALQUIER via
    // (formulario y OAuth; el hook de `/sign-up/email` no cubre el callback).
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            if (!isAuthorizedEmail(user.email)) {
              throw new APIError('UNPROCESSABLE_ENTITY', {
                code: UNAUTHORIZED_DOMAIN_ERROR_CODE,
                message: unauthorizedDomainMessage(
                  getAuthorizedEmailDomains(),
                ),
              });
            }
          },
        },
      },
    },
    user: {
      additionalFields: {
        // RF-001: el rol no lo elige el usuario (input: false) y por
        // defecto es STUDENT; el administrador lo reasigna despues.
        role: {
          type: 'string',
          required: false,
          defaultValue: DEFAULT_USER_ROLE,
          input: false,
          returned: true,
        },
        // Contador de intentos fallidos (RF-010). Interno: no se expone
        // al cliente (returned: false) ni es escribible (input: false).
        failedAttempts: {
          type: 'number',
          required: false,
          defaultValue: 0,
          input: false,
          returned: false,
        },
        // Instante hasta el que la cuenta esta bloqueada. Interno.
        lockedUntil: {
          type: 'date',
          required: false,
          input: false,
          returned: false,
        },
      },
    },
    // Sesiones via header Authorization: Bearer <token> (localStorage en el
    // frontend) en lugar de cookies. El plugin expone el token en el header
    // de respuesta `set-auth-token` al crear una sesion.
    plugins: [bearer()],
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path === SIGN_UP_EMAIL_PATH) {
          // BR-005 + RF-015: solo dominios autorizados (institucional por
          // defecto, mas los externos configurados en AUTHORIZED_EMAIL_DOMAINS).
          const domains = getAuthorizedEmailDomains();
          if (!isAuthorizedEmail(ctx.body?.email, domains)) {
            throw new APIError('UNPROCESSABLE_ENTITY', {
              code: UNAUTHORIZED_DOMAIN_ERROR_CODE,
              message: unauthorizedDomainMessage(domains),
            });
          }
          return;
        }

        if (ctx.path === SIGN_IN_EMAIL_PATH) {
          const email =
            typeof ctx.body?.email === 'string' ? ctx.body.email : null;
          if (!email) {
            return; // La validacion del propio endpoint responde 400.
          }
          const record =
            await ctx.context.internalAdapter.findUserByEmail(email);
          const user = record?.user as UserLockoutRow | undefined;
          // Usuario inexistente: no revelar nada (anti-enumeracion).
          if (!user) {
            return;
          }
          const evaluation = evaluateLockout(user, new Date());
          if (evaluation.locked) {
            throw new APIError('LOCKED', {
              message: `Cuenta bloqueada temporalmente por multiples intentos fallidos. Intenta de nuevo en ${ACCOUNT_LOCKOUT_MINUTES} minutos.`,
            });
          }
          if (user.lockedUntil) {
            // El bloqueo expiro: limpiar el estado viejo.
            await ctx.context.internalAdapter.updateUser(user.id, {
              ...nextStateAfterSuccess(),
            });
          }
        }
      }),
      after: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== SIGN_IN_EMAIL_PATH) {
          return;
        }
        const returned = ctx.context.returned;
        if (isAPIError(returned)) {
          // Solo las credenciales invalidas (401) cuentan como intento
          // fallido; otros errores (400, 423, 429) no.
          if (returned.statusCode !== 401) {
            return;
          }
          const email =
            typeof ctx.body?.email === 'string' ? ctx.body.email : null;
          if (!email) {
            return;
          }
          const record =
            await ctx.context.internalAdapter.findUserByEmail(email);
          const user = record?.user as UserLockoutRow | undefined;
          if (!user) {
            return;
          }
          await ctx.context.internalAdapter.updateUser(user.id, {
            ...nextStateAfterFailure(
              { failedAttempts: user.failedAttempts ?? 0 },
              new Date(),
            ),
          });
          return;
        }
        // Login exitoso: resetear el contador (RF-010).
        const userId = ctx.context.newSession?.user?.id;
        if (userId) {
          await ctx.context.internalAdapter.updateUser(userId, {
            ...nextStateAfterSuccess(),
          });
        }
      }),
    },
  };
}
