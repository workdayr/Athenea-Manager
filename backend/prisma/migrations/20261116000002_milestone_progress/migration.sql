-- F2-07 / BR-008: seguimiento de avance y avisos de vencimiento de hitos.
-- Idempotente.

ALTER TABLE "Milestone"
  ADD COLUMN IF NOT EXISTS "last_progress_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "Milestone"
  ADD COLUMN IF NOT EXISTS "due_notice_days" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "Milestone_status_last_progress_at_idx"
  ON "Milestone" ("status", "last_progress_at");
