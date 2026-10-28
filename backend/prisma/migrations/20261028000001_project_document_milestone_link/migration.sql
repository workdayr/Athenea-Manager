-- US 5.2: el esquema Prisma declara `ProjectDocument.milestone_id` y la
-- relacion con `Milestone`, pero la base de datos de algunos entornos no
-- recibio esa columna (la migracion historica quedo registrada sin aplicarla
-- por completo). Sin ella, Prisma falla al leer/escribir documentos con
-- evidencia de hitos (P2022).
--
-- Idempotente: seguro ante reintentos tras un fallo parcial.

ALTER TABLE "ProjectDocument"
  ADD COLUMN IF NOT EXISTS "milestone_id" INTEGER;

CREATE INDEX IF NOT EXISTS "ProjectDocument_milestone_id_idx"
  ON "ProjectDocument"("milestone_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ProjectDocument_milestone_id_fkey'
  ) THEN
    ALTER TABLE "ProjectDocument"
      ADD CONSTRAINT "ProjectDocument_milestone_id_fkey"
      FOREIGN KEY ("milestone_id") REFERENCES "Milestone"("milestone_id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
