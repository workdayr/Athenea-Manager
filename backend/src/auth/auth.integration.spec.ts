import { betterAuth } from 'better-auth';
import { type MemoryDB, memoryAdapter } from 'better-auth/adapters/memory';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildAuthOptions } from './auth.config.js';
import {
  DEFAULT_USER_ROLE,
  UNAUTHORIZED_DOMAIN_ERROR_CODE,
} from './auth.constants.js';

type AuthInstance = ReturnType<typeof betterAuth>;
type MemoryRow = Record<string, unknown>;

// La config lee BETTER_AUTH_URL al construir la instancia.
process.env.BETTER_AUTH_URL ??= 'http://localhost:3001';

function createTestAuth(): AuthInstance {
  const db = {
    user: [],
    session: [],
    account: [],
    verification: [],
  } as unknown as MemoryDB;
  return betterAuth(buildAuthOptions(memoryAdapter(db)));
}

async function findUser(
  auth: AuthInstance,
  email: string,
): Promise<MemoryRow> {
  const ctx = await auth.$context;
  const user = await ctx.adapter.findOne({
    model: 'user',
    where: [{ field: 'email', value: email }],
  });
  if (!user) {
    throw new Error(`Usuario ${email} no encontrado en la base de memoria`);
  }
  return user as unknown as MemoryRow;
}

const PASSWORD = 'ContrasenaSegura123';

describe('Registro (RF-010, BR-005)', () => {
  let auth: AuthInstance;

  beforeEach(() => {
    auth = createTestAuth();
  });

  it('registra un usuario con correo institucional', async () => {
    const res = await auth.api.signUpEmail({
      body: {
        name: 'Alumna Ejemplo',
        email: 'alumna@unipolidgo.edu.mx',
        password: PASSWORD,
      },
    });

    expect(res.token).toBeDefined();
    expect(res.user.email).toBe('alumna@unipolidgo.edu.mx');
    // RF-001: rol por defecto STUDENT.
    expect((res.user as MemoryRow).role).toBe(DEFAULT_USER_ROLE);

    const row = await findUser(auth, 'alumna@unipolidgo.edu.mx');
    // RNF-006 / RF-010: bcrypt cost 12, nunca texto plano. El hash vive en
    // la fila `account` del proveedor de credenciales.
    const ctx = await auth.$context;
    const account = (await ctx.adapter.findOne({
      model: 'account',
      where: [
        { field: 'userId', value: res.user.id },
        { field: 'providerId', value: 'credential' },
      ],
    })) as unknown as MemoryRow;
    expect(account?.password).toMatch(/^\$2[aby]\$12\$/);
    expect(account?.password).not.toContain(PASSWORD);
    expect(row.failedAttempts).toBe(0);
  });

  it('rechaza correos fuera del dominio institucional con 422', async () => {
    await expect(
      auth.api.signUpEmail({
        body: {
          name: 'Externo',
          email: 'alumno@gmail.com',
          password: PASSWORD,
        },
      }),
    ).rejects.toThrowError(expect.objectContaining({ statusCode: 422 }));

    await expect(
      findUser(auth, 'alumno@gmail.com'),
    ).rejects.toThrow();
  });

  it('rechaza contrasenas fuera del rango 8-64 caracteres', async () => {
    await expect(
      auth.api.signUpEmail({
        body: {
          name: 'Corta',
          email: 'corta@unipolidgo.edu.mx',
          password: 'abc1234', // 7 caracteres
        },
      }),
    ).rejects.toThrowError(expect.objectContaining({ statusCode: 400 }));

    await expect(
      auth.api.signUpEmail({
        body: {
          name: 'Larga',
          email: 'larga@unipolidgo.edu.mx',
          password: 'a'.repeat(65),
        },
      }),
    ).rejects.toThrowError(expect.objectContaining({ statusCode: 400 }));
  });

  it('el cliente no puede fijar su propio rol (se fuerza STUDENT)', async () => {
    const res = await auth.api.signUpEmail({
      body: {
        name: 'Vivo',
        email: 'vivo@unipolidgo.edu.mx',
        password: PASSWORD,
        // @ts-expect-error: el campo no es escribible por el cliente
        role: 'ADMINISTRATOR',
      },
    });
    // RF-001: el valor enviado se ignora y se aplica el rol por defecto.
    expect((res.user as MemoryRow).role).toBe(DEFAULT_USER_ROLE);
  });

  it('rechaza correos duplicados', async () => {
    const body = {
      name: 'Duplicada',
      email: 'duplicada@unipolidgo.edu.mx',
      password: PASSWORD,
    };
    await auth.api.signUpEmail({ body });
    await expect(auth.api.signUpEmail({ body })).rejects.toThrow();
  });
});

describe('Login y bloqueo de cuenta (RF-010)', () => {
  let auth: AuthInstance;
  const email = 'login@unipolidgo.edu.mx';

  beforeEach(async () => {
    auth = createTestAuth();
    await auth.api.signUpEmail({
      body: { name: 'Login', email, password: PASSWORD },
    });
  });

  it('inicia sesion con credenciales validas y resetea el contador', async () => {
    // Dos fallos previos...
    for (let i = 0; i < 2; i++) {
      await expect(
        auth.api.signInEmail({ body: { email, password: 'incorrecta1' } }),
      ).rejects.toThrowError(expect.objectContaining({ statusCode: 401 }));
    }
    expect((await findUser(auth, email)).failedAttempts).toBe(2);

    // ...y un login exitoso resetea.
    const res = await auth.api.signInEmail({
      body: { email, password: PASSWORD },
    });
    expect(res.token).toBeDefined();
    expect((await findUser(auth, email)).failedAttempts).toBe(0);
  });

  it('bloquea la cuenta con 423 tras 5 intentos fallidos', async () => {
    for (let i = 0; i < 5; i++) {
      await expect(
        auth.api.signInEmail({ body: { email, password: 'incorrecta1' } }),
      ).rejects.toThrowError(expect.objectContaining({ statusCode: 401 }));
    }

    const row = await findUser(auth, email);
    expect(row.failedAttempts).toBe(5);
    expect(row.lockedUntil).toBeInstanceOf(Date);

    // Incluso con la contrasena correcta, la cuenta esta bloqueada.
    await expect(
      auth.api.signInEmail({ body: { email, password: PASSWORD } }),
    ).rejects.toThrowError(expect.objectContaining({ statusCode: 423 }));
  });

  it('permite el login cuando el bloqueo ya expiro', async () => {
    const ctx = await auth.$context;
    await ctx.internalAdapter.updateUserByEmail(email, {
      failedAttempts: 5,
      lockedUntil: new Date(Date.now() - 1000), // expiro hace 1s
    });

    const res = await auth.api.signInEmail({
      body: { email, password: PASSWORD },
    });
    expect(res.token).toBeDefined();
    expect((await findUser(auth, email)).failedAttempts).toBe(0);
  });

  it('responde 401 generico para usuarios inexistentes (anti-enumeracion)', async () => {
    await expect(
      auth.api.signInEmail({
        body: { email: 'nadie@unipolidgo.edu.mx', password: 'incorrecta1' },
      }),
    ).rejects.toThrowError(expect.objectContaining({ statusCode: 401 }));
  });
});

describe('Sesion via Bearer (frontend localStorage)', () => {
  it('getSession acepta el header Authorization: Bearer', async () => {
    const auth = createTestAuth();
    const email = 'bearer@unipolidgo.edu.mx';
    await auth.api.signUpEmail({
      body: { name: 'Bearer', email, password: PASSWORD },
    });
    const signIn = await auth.api.signInEmail({
      body: { email, password: PASSWORD },
    });

    const session = await auth.api.getSession({
      headers: new Headers({ authorization: `Bearer ${signIn.token}` }),
    });
    expect(session?.user.email).toBe(email);
  });
});

describe('Politica de dominios en creacion por cualquier via (RF-015)', () => {
  it('databaseHooks rechaza dominios no autorizados (ruta del callback OAuth)', async () => {
    const auth = createTestAuth();
    const ctx = await auth.$context;

    // El callback OAuth crea el usuario via internalAdapter.createUser, que
    // pasa por databaseHooks (el hook de /sign-up/email no lo cubre). El
    // `code` es lo que permite al callback redirigir con ?error= en lugar
    // de devolver el JSON crudo al navegador.
    const failure = await ctx.internalAdapter
      .createUser(
        {
          name: 'Externo',
          email: 'externo@gmail.com',
          emailVerified: false,
        },
        { method: 'oauth', oauth: { providerId: 'google' } },
      )
      .then(
        () => null,
        (error: unknown) => error,
      );
    expect(failure).toMatchObject({ statusCode: 422 });
    expect(
      (failure as { body?: { code?: string } } | null)?.body?.code,
    ).toBe(UNAUTHORIZED_DOMAIN_ERROR_CODE);
  });

  it('databaseHooks acepta dominios externos autorizados por entorno', async () => {
    const previous = process.env.AUTHORIZED_EMAIL_DOMAINS;
    process.env.AUTHORIZED_EMAIL_DOMAINS = 'socio.edu.mx';
    try {
      const auth = createTestAuth();
      const ctx = await auth.$context;
      const user = await ctx.internalAdapter.createUser(
        {
          name: 'Socio',
          email: 'socio@socio.edu.mx',
          emailVerified: true,
        },
        { method: 'email-password' },
      );
      expect(user?.email).toBe('socio@socio.edu.mx');
      expect((user as MemoryRow)?.role).toBe(DEFAULT_USER_ROLE);
    } finally {
      if (previous === undefined) {
        delete process.env.AUTHORIZED_EMAIL_DOMAINS;
      } else {
        process.env.AUTHORIZED_EMAIL_DOMAINS = previous;
      }
    }
  });
});

describe('Proveedor Google (RF-015)', () => {
  const GOOGLE_ENV = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'] as const;

  function setGoogleEnv(value: string | undefined) {
    const previous = GOOGLE_ENV.map((key) => process.env[key]);
    for (const key of GOOGLE_ENV) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    return previous;
  }

  function restoreGoogleEnv(previous: (string | undefined)[]) {
    GOOGLE_ENV.forEach((key, index) => {
      if (previous[index] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previous[index];
      }
    });
  }

  it('la vinculacion silenciosa esta ACTIVADA (mismo email, sin confirmacion)', async () => {
    // RF-015: Google con email existente vincula solo y entra directo al
    // dashboard. Este test fija la decision de politica en la config
    // resuelta (el flujo completo requeriria credenciales reales de Google).
    const auth = createTestAuth();
    const ctx = await auth.$context;
    const linking = ctx.options.account?.accountLinking;
    expect(linking?.enabled).toBe(true);
    expect(linking?.allowDifferentEmails).not.toBe(true);
    // Sin esto, BetterAuth rechaza vincular cuentas creadas por formulario
    // (emailVerified=false, no hay flujo de verificacion) con
    // `account_not_linked`: Google verifica el correo y el dominio
    // institucional restringe el registro.
    expect(linking?.requireLocalEmailVerified).toBe(false);
    expect(linking?.trustedProviders).toContain('google');
  });

  it('sin credenciales el proveedor no existe (404)', async () => {
    const previous = setGoogleEnv(undefined);
    try {
      const auth = createTestAuth();
      await expect(
        auth.api.signInSocial({
          body: {
            provider: 'google',
            callbackURL: 'http://localhost:3000/dashboard',
          },
        }),
      ).rejects.toThrowError(expect.objectContaining({ statusCode: 404 }));
    } finally {
      restoreGoogleEnv(previous);
    }
  });

  it('con credenciales inicia el flujo OAuth (devuelve URL de Google)', async () => {
    const previous = setGoogleEnv('test-id');
    try {
      const auth = createTestAuth();
      const res = await auth.api.signInSocial({
        body: {
          provider: 'google',
          callbackURL: 'http://localhost:3000/dashboard',
        },
      });
      expect(res.redirect).toBe(true);
      expect(res.url).toContain('accounts.google.com');
      expect(res.url).toContain('client_id=test-id');
    } finally {
      restoreGoogleEnv(previous);
    }
  });

  it('el registro por formulario con dominio externo autorizado funciona', async () => {
    const previous = process.env.AUTHORIZED_EMAIL_DOMAINS;
    process.env.AUTHORIZED_EMAIL_DOMAINS = 'socio.edu.mx';
    try {
      const auth = createTestAuth();
      const res = await auth.api.signUpEmail({
        body: {
          name: 'Socio Form',
          email: 'form@socio.edu.mx',
          password: PASSWORD,
        },
      });
      expect(res.user.email).toBe('form@socio.edu.mx');
    } finally {
      if (previous === undefined) {
        delete process.env.AUTHORIZED_EMAIL_DOMAINS;
      } else {
        process.env.AUTHORIZED_EMAIL_DOMAINS = previous;
      }
    }
  });
});
