import { betterAuth } from 'better-auth';
import { type MemoryDB, memoryAdapter } from 'better-auth/adapters/memory';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildAuthOptions } from './auth.config.js';
import { DEFAULT_USER_ROLE } from './auth.constants.js';

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
    expect(res.user.role).toBe(DEFAULT_USER_ROLE);

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
    expect(res.user.role).toBe(DEFAULT_USER_ROLE);
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
