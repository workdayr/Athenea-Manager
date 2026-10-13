import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { toNodeHandler } from 'better-auth/node';
import { json, urlencoded } from 'body-parser';
import type { Express } from 'express';
import { AppModule } from './app.module.js';
import { auth } from './auth/auth.js';

async function bootstrap() {
  // Desactivamos el body-parser de Nest para que BetterAuth pueda leer el
  // cuerpo crudo de sus propias rutas; lo registramos manualmente despues.
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  const frontendOrigin =
    process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000';

  // Se aceptan localhost y 127.0.0.1 (el navegador puede abrir el frontend
  // con cualquiera) mas el origen configurado. El flujo principal usa el
  // proxy same-origin de Next, pero el acceso directo a la API sigue abierto.
  const allowedOrigins = [
    ...new Set([
      frontendOrigin,
      'http://localhost:3000',
      'http://127.0.0.1:3000',
    ]),
  ];

  app.enableCors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    // El plugin `bearer` expone el token de sesion en este header.
    exposedHeaders: ['set-auth-token'],
  });

  const expressApp = app.getHttpAdapter().getInstance() as Express;

  // Rutas de autenticacion de BetterAuth (/api/auth/*). Se monta ANTES del
  // body-parser, como exige la documentacion oficial. Sintaxis de wildcard
  // de Express 5 (la version que usa @nestjs/platform-express).
  expressApp.all('/api/auth/{*splat}', toNodeHandler(auth));

  // Body parsers para el resto de rutas NestJS.
  app.use(json({ limit: '1mb' }));
  app.use(urlencoded({ extended: true, limit: '1mb' }));

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
}
await bootstrap();
