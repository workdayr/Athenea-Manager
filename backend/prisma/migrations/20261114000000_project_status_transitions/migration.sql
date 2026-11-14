-- F1-02 / RF-003: maquina de estados del ciclo de vida del proyecto.
--
-- 1) Project.status_changed_at: fecha del ultimo cambio de estado; el job
--    de SLA la usa para detectar proyectos Under_Review > 30 dias.
-- 2) Project.sla_notified_at: marca idempotente del aviso enviado.
-- 3) Project_Status_Transition: bitacora inmutable de cada transicion.
--
-- Idempotente: las migraciones DDL contra el pooler de Neon pueden fallar a
-- mitad de camino y reejecutarse.

ALTER TABLE "Project"
  ADD COLUMN IF NOT EXISTS "status_changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "Project"
  ADD COLUMN IF NOT EXISTS "sla_notified_at" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "Project_Status_Transition" (
  "transition_id" SERIAL NOT NULL,
  "project_id"    INTEGER NOT NULL,
  "actor_id"      TEXT NOT NULL,
  "from_status"   "ProjectStatus" NOT NULL,
  "to_status"     "ProjectStatus" NOT NULL,
  "justification" TEXT,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Project_Status_Transition_pkey" PRIMARY KEY ("transition_id")
);

CREATE INDEX IF NOT EXISTS "Project_status_status_changed_at_idx"
  ON "Project"("status", "status_changed_at");

CREATE INDEX IF NOT EXISTS "Project_status_sla_notified_at_idx"
  ON "Project"("status", "sla_notified_at");

CREATE INDEX IF NOT EXISTS "Project_Status_Transition_project_id_created_at_idx"
  ON "Project_Status_Transition"("project_id", "created_at");

CREATE INDEX IF NOT EXISTS "Project_Status_Transition_actor_id_idx"
  ON "Project_Status_Transition"("actor_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Project_Status_Transition_project_id_fkey'
  ) THEN
    ALTER TABLE "Project_Status_Transition"
      ADD CONSTRAINT "Project_Status_Transition_project_id_fkey"
      FOREIGN KEY ("project_id") REFERENCES "Project"("project_id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Project_Status_Transition_actor_id_fkey'
  ) THEN
    ALTER TABLE "Project_Status_Transition"
      ADD CONSTRAINT "Project_Status_Transition_actor_id_fkey"
      FOREIGN KEY ("actor_id") REFERENCES "user"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
