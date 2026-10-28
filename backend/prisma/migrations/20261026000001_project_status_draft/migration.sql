-- RF-008 / RF-002: el esquema Prisma y el enum GraphQL ya exponen el estado
-- `Draft`, pero la base de datos de algunos entornos se quedo atras. Alinear
-- el enum de PostgreSQL evita errores al filtrar por ese estado desde el
-- dashboard institucional.
--
-- Idempotente: seguro ante reintentos tras un fallo parcial (DDL no
-- transaccional contra el pooler de Neon).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'public."ProjectStatus"'::regtype
      AND enumlabel = 'Draft'
  ) THEN
    ALTER TYPE public."ProjectStatus" ADD VALUE 'Draft';
  END IF;
END $$;
