import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { prisma } from '../db/prisma.js';
import { buildAuthOptions } from './auth.config.js';

/**
 * Instancia de produccion de BetterAuth (PostgreSQL via Prisma).
 * Los tests usan `buildAuthOptions` con el adapter de memoria
 * (`better-auth/adapters/memory`) en su lugar.
 */
export const auth = betterAuth(
  buildAuthOptions(
    prismaAdapter(prisma, {
      provider: 'postgresql',
    }),
  ),
);
