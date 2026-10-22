-- US "Evidence upload" (RF-016): añade el tipo documental 'evidence'
-- al enum DocType para clasificar archivos de evidencia de trabajo.
-- Idempotente: segura ante reintentos tras un fallo parcial (DDL no
-- transaccional contra el pooler de Neon).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'public."DocType"'::regtype
      AND enumlabel = 'evidence'
  ) THEN
    ALTER TYPE public."DocType" ADD VALUE 'evidence';
  END IF;
END $$;
