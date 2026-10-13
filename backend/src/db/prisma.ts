import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    'DATABASE_URL is not set. Define it in backend/.env (see .env.example).',
  );
}

const adapter = new PrismaPg({ connectionString });

const globalForPrisma = globalThis as unknown as {
  __atheneaPrisma?: PrismaClient;
};

/**
 * Singleton del cliente Prisma (patron recomendado para evitar agotar el
 * pool de conexiones con hot-reload en desarrollo).
 */
export const prisma =
  globalForPrisma.__atheneaPrisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__atheneaPrisma = prisma;
}
