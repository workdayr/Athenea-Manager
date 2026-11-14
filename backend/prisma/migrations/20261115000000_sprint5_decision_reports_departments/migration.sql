-- Sprint 5 (F1-10 / RF-019 y BR-004): dictamen PDF asincrono y departamentos.
--
-- 1) User.department: departamento academico usado por BR-004.
-- 2) Decision_Report: estado de generacion del dictamen (Pending/Ready/Failed).
--
-- Idempotente: seguro para reejecuciones en PostgreSQL.

ALTER TABLE "user"
  ADD COLUMN IF NOT EXISTS "department" VARCHAR(120);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DecisionReportStatus') THEN
    CREATE TYPE "DecisionReportStatus" AS ENUM ('Pending', 'Ready', 'Failed');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "Decision_Report" (
  "report_id"     SERIAL NOT NULL,
  "evaluation_id" INTEGER NOT NULL,
  "status"        "DecisionReportStatus" NOT NULL DEFAULT 'Pending',
  "file_path"     TEXT,
  "error"         TEXT,
  "attempts"      INTEGER NOT NULL DEFAULT 0,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ready_at"      TIMESTAMP(3),
  CONSTRAINT "Decision_Report_pkey" PRIMARY KEY ("report_id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Decision_Report_evaluation_id_key"
  ON "Decision_Report"("evaluation_id");

CREATE INDEX IF NOT EXISTS "Decision_Report_status_created_at_idx"
  ON "Decision_Report"("status", "created_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Decision_Report_evaluation_id_fkey'
  ) THEN
    ALTER TABLE "Decision_Report"
      ADD CONSTRAINT "Decision_Report_evaluation_id_fkey"
      FOREIGN KEY ("evaluation_id") REFERENCES "Proposal_Evaluation"("evaluation_id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
