-- F1-11 / BR-006, BR-007, BR-012, BR-013: reglas eticas, confidencialidad,
-- anonimizacion y retencion de datos.
--
-- 1) Project: banderas de investigacion sensible, certificacion de
--    anonimizacion y fechas de retencion.
-- 2) ProjectDocument: estado de revision (BR-003) y trazabilidad.
-- 3) NotificationType: alertas de SLA y retencion.
--
-- Idempotente: las migraciones DDL contra el pooler de Neon pueden fallar a
-- mitad de camino y reejecutarse.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'DocumentReviewStatus'
  ) THEN
    CREATE TYPE "DocumentReviewStatus" AS ENUM (
      'Pending',
      'Approved',
      'Rejected'
    );
  END IF;
END $$;

ALTER TABLE "Project"
  ADD COLUMN IF NOT EXISTS "research_involves_humans" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Project"
  ADD COLUMN IF NOT EXISTS "research_involves_animals" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Project"
  ADD COLUMN IF NOT EXISTS "uses_sensitive_data" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Project"
  ADD COLUMN IF NOT EXISTS "anonymization_certified" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Project"
  ADD COLUMN IF NOT EXISTS "anonymization_certified_at" TIMESTAMP(3);

ALTER TABLE "Project"
  ADD COLUMN IF NOT EXISTS "anonymization_certified_by" TEXT;

ALTER TABLE "Project"
  ADD COLUMN IF NOT EXISTS "retention_delete_at" TIMESTAMP(3);

ALTER TABLE "Project"
  ADD COLUMN IF NOT EXISTS "retention_notified_at" TIMESTAMP(3);

ALTER TABLE "Project"
  ADD COLUMN IF NOT EXISTS "retention_deleted_at" TIMESTAMP(3);

ALTER TABLE "ProjectDocument"
  ADD COLUMN IF NOT EXISTS "review_status" "DocumentReviewStatus" NOT NULL DEFAULT 'Pending';

ALTER TABLE "ProjectDocument"
  ADD COLUMN IF NOT EXISTS "reviewed_at" TIMESTAMP(3);

ALTER TABLE "ProjectDocument"
  ADD COLUMN IF NOT EXISTS "reviewed_by" TEXT;

ALTER TABLE "ProjectDocument"
  ADD COLUMN IF NOT EXISTS "review_notes" TEXT;

CREATE INDEX IF NOT EXISTS "Project_retention_delete_at_idx"
  ON "Project"("retention_delete_at");

CREATE INDEX IF NOT EXISTS "Project_status_retention_delete_at_idx"
  ON "Project"("status", "retention_delete_at");

CREATE INDEX IF NOT EXISTS "ProjectDocument_project_id_doc_type_review_status_idx"
  ON "ProjectDocument"("project_id", "doc_type", "review_status");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Project_anonymization_certified_by_fkey'
  ) THEN
    ALTER TABLE "Project"
      ADD CONSTRAINT "Project_anonymization_certified_by_fkey"
      FOREIGN KEY ("anonymization_certified_by") REFERENCES "user"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ProjectDocument_reviewed_by_fkey'
  ) THEN
    ALTER TABLE "ProjectDocument"
      ADD CONSTRAINT "ProjectDocument_reviewed_by_fkey"
      FOREIGN KEY ("reviewed_by") REFERENCES "user"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- F1-02 / F1-11: nuevos tipos de notificacion. En PostgreSQL 12+ se puede
-- agregar un valor de enum dentro de una transaccion siempre que no se use
-- en la misma transaccion; aqui solo se declara.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'Retention';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'Sla';
