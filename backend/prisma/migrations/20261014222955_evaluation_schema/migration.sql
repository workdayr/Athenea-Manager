-- Modulo proposal_evaluation (RF-019, BR-011, RF-003/UC-003).
-- 1) Vincula Project_User.user_id y Audit_Log.actor_id (INT huerfanos de la
--    tabla legacy Users) a la tabla de usuarios de BetterAuth ("user").
-- 2) Crea las tablas de decisiones formales y de alertas de conflicto.
-- Idempotente: segura ante reintentos tras un fallo parcial (migraciones
-- DDL contra el pooler de Neon no son transaccionales).

-- El ALTER TYPE sobre una columna ya TEXT es no-op: seguro reejecutarlo.
ALTER TABLE "Project_User" ALTER COLUMN "user_id" TYPE TEXT;
ALTER TABLE "Project_User" DROP CONSTRAINT IF EXISTS "Project_User_user_id_fkey";
ALTER TABLE "Project_User" ADD CONSTRAINT "Project_User_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id");

ALTER TABLE "Audit_Log" ALTER COLUMN "actor_id" TYPE TEXT;
ALTER TABLE "Audit_Log" DROP CONSTRAINT IF EXISTS "Audit_Log_actor_id_fkey";
ALTER TABLE "Audit_Log" ADD CONSTRAINT "Audit_Log_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "user"("id");

-- Historial formal de decisiones del comite con justificacion obligatoria.
DO $$ BEGIN
  CREATE TYPE "EvaluationDecision" AS ENUM ('Approved', 'Rejected', 'Revision_Required');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "Proposal_Evaluation" (
  "evaluation_id" SERIAL NOT NULL,
  "project_id" INTEGER NOT NULL,
  "reviewer_id" TEXT NOT NULL,
  "decision" "EvaluationDecision" NOT NULL,
  "justification" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Proposal_Evaluation_pkey" PRIMARY KEY ("evaluation_id")
);

ALTER TABLE "Proposal_Evaluation" DROP CONSTRAINT IF EXISTS "Proposal_Evaluation_project_id_fkey";
ALTER TABLE "Proposal_Evaluation" ADD CONSTRAINT "Proposal_Evaluation_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("project_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Proposal_Evaluation" DROP CONSTRAINT IF EXISTS "Proposal_Evaluation_reviewer_id_fkey";
ALTER TABLE "Proposal_Evaluation" ADD CONSTRAINT "Proposal_Evaluation_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "Proposal_Evaluation_project_id_idx" ON "Proposal_Evaluation"("project_id");
CREATE INDEX IF NOT EXISTS "Proposal_Evaluation_reviewer_id_idx" ON "Proposal_Evaluation"("reviewer_id");

-- Alertas de conflicto de interes familiar persistentes (unicas por par).
DO $$ BEGIN
  CREATE TYPE "ConflictStatus" AS ENUM ('Pending', 'Cleared', 'Confirmed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "Review_Conflict" (
  "conflict_id" SERIAL NOT NULL,
  "project_id" INTEGER NOT NULL,
  "reviewer_id" TEXT NOT NULL,
  "status" "ConflictStatus" NOT NULL DEFAULT 'Pending',
  "detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolved_at" TIMESTAMP(3),
  "resolved_by" TEXT,
  "resolution_note" TEXT,

  CONSTRAINT "Review_Conflict_pkey" PRIMARY KEY ("conflict_id")
);

ALTER TABLE "Review_Conflict" DROP CONSTRAINT IF EXISTS "Review_Conflict_project_id_fkey";
ALTER TABLE "Review_Conflict" ADD CONSTRAINT "Review_Conflict_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("project_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Review_Conflict" DROP CONSTRAINT IF EXISTS "Review_Conflict_reviewer_id_fkey";
ALTER TABLE "Review_Conflict" ADD CONSTRAINT "Review_Conflict_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Review_Conflict" DROP CONSTRAINT IF EXISTS "Review_Conflict_resolved_by_fkey";
ALTER TABLE "Review_Conflict" ADD CONSTRAINT "Review_Conflict_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

DO $$ BEGIN
  ALTER TABLE "Review_Conflict" ADD CONSTRAINT "Review_Conflict_project_id_reviewer_id_key" UNIQUE ("project_id", "reviewer_id");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "Review_Conflict_status_idx" ON "Review_Conflict"("status");
