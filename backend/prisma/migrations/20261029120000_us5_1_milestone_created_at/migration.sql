-- Reconstruida durante la reconciliacion del historial (2026-11-13).
-- La base de desarrollo ya tenia aplicada esta migracion, pero el archivo
-- original no estaba en el repositorio ni en el historial de Git.
-- Efecto observado en la base: `Milestone.created_at` con default now().

-- AlterTable
ALTER TABLE "Milestone"
  ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
