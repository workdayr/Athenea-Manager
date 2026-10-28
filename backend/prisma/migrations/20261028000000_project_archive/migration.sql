-- RF-020: archivo institucional inmutable de proyectos cerrados.
--
-- 1) Marca de solo lectura y fecha de archivado en Project.
-- 2) Snapshot congelado del expediente (JSONB) + hash SHA-256.
-- 3) Alertas persistentes para fallos de archivado.
--
-- Idempotente: las migraciones DDL contra el pooler de Neon pueden fallar a
-- mitad de camino y reejecutarse.

ALTER TABLE "Project"
  ADD COLUMN IF NOT EXISTS "is_read_only" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Project"
  ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Project_status_is_read_only_idx"
  ON "Project"("status", "is_read_only");

CREATE TABLE IF NOT EXISTS "Project_Archive" (
  "archive_id"    SERIAL NOT NULL,
  "project_id"    INTEGER NOT NULL,
  "snapshot"      JSONB NOT NULL,
  "snapshot_hash" VARCHAR(64) NOT NULL,
  "archived_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Project_Archive_pkey" PRIMARY KEY ("archive_id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Project_Archive_project_id_key"
  ON "Project_Archive"("project_id");

CREATE INDEX IF NOT EXISTS "Project_Archive_archived_at_idx"
  ON "Project_Archive"("archived_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Project_Archive_project_id_fkey'
  ) THEN
    ALTER TABLE "Project_Archive"
      ADD CONSTRAINT "Project_Archive_project_id_fkey"
      FOREIGN KEY ("project_id") REFERENCES "Project"("project_id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "Archive_Alert" (
  "alert_id"      SERIAL NOT NULL,
  "project_id"    INTEGER,
  "attempted_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "error_message" TEXT NOT NULL,
  "resolved_at"   TIMESTAMP(3),
  CONSTRAINT "Archive_Alert_pkey" PRIMARY KEY ("alert_id")
);

CREATE INDEX IF NOT EXISTS "Archive_Alert_project_id_attempted_at_idx"
  ON "Archive_Alert"("project_id", "attempted_at");

CREATE INDEX IF NOT EXISTS "Archive_Alert_resolved_at_idx"
  ON "Archive_Alert"("resolved_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Archive_Alert_project_id_fkey'
  ) THEN
    ALTER TABLE "Archive_Alert"
      ADD CONSTRAINT "Archive_Alert_project_id_fkey"
      FOREIGN KEY ("project_id") REFERENCES "Project"("project_id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
