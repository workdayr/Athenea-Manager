-- RF-008 / UC-009: soporte de datos e indices para el dashboard institucional.
-- Idempotente: las migraciones DDL contra el pooler de Neon pueden fallar a
-- mitad de camino y reejecutarse.

-- 1) Fecha del gasto: permite filtrar el presupuesto ejercido por el rango
--    seleccionado en el dashboard. El backfill usa la fecha de inicio del
--    proyecto para no concentrar gastos historicos en la fecha de migracion.
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "expense_date" DATE;

UPDATE "Expense" e
SET "expense_date" = p."start_date"::date
FROM "Project" p
WHERE e."project_id" = p."project_id"
  AND e."expense_date" IS NULL;

UPDATE "Expense"
SET "expense_date" = CURRENT_DATE
WHERE "expense_date" IS NULL;

ALTER TABLE "Expense" ALTER COLUMN "expense_date" SET DEFAULT CURRENT_DATE;
ALTER TABLE "Expense" ALTER COLUMN "expense_date" SET NOT NULL;

-- 2) Indices de reporte (RF-008 / RF-013 / RNF-002).
CREATE INDEX IF NOT EXISTS "Project_status_idx" ON "Project"("status");
CREATE INDEX IF NOT EXISTS "Project_start_date_end_date_idx" ON "Project"("start_date", "end_date");
CREATE INDEX IF NOT EXISTS "Project_call_id_idx" ON "Project"("call_id");

CREATE INDEX IF NOT EXISTS "Project_User_project_id_project_role_idx" ON "Project_User"("project_id", "project_role");
CREATE INDEX IF NOT EXISTS "Project_User_user_id_idx" ON "Project_User"("user_id");

CREATE INDEX IF NOT EXISTS "ProjectDocument_project_id_idx" ON "ProjectDocument"("project_id");

-- La columna milestone_id existe en el esquema Prisma, pero algunos
-- entornos no la tienen aplicada (deriva previa de la migracion US 5.1).
-- El indice se crea solo cuando la columna esta disponible para que esta
-- migracion sea segura en todos los entornos.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ProjectDocument'
      AND column_name = 'milestone_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS "ProjectDocument_milestone_id_idx" ON "ProjectDocument"("milestone_id");
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Milestone_project_id_status_due_date_idx" ON "Milestone"("project_id", "status", "due_date");
CREATE INDEX IF NOT EXISTS "Milestone_assignee_id_idx" ON "Milestone"("assignee_id");

CREATE INDEX IF NOT EXISTS "Product_project_id_idx" ON "Product"("project_id");
CREATE INDEX IF NOT EXISTS "Expense_project_id_expense_date_idx" ON "Expense"("project_id", "expense_date");

CREATE INDEX IF NOT EXISTS "Proposal_Evaluation_created_at_idx" ON "Proposal_Evaluation"("created_at");
