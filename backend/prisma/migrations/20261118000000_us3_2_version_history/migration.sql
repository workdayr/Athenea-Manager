-- US 3.2: historial cronologico de versiones y comentarios del comite.
--
-- 1) Proposal_Version guarda el comentario del PI, el dictamen que resolvio
--    la version (evaluacion, revisor y fecha) y el estado final.
-- 2) Backfill: los proyectos ya enviados reciben su version 1 con los
--    documentos de registro vinculados, para que el historial empiece en la
--    propuesta inicial y no en la primera correccion.
--
-- Idempotente: seguro para reejecuciones en PostgreSQL.

ALTER TABLE "Proposal_Version"
  ADD COLUMN IF NOT EXISTS "submitter_comment" TEXT;

ALTER TABLE "Proposal_Version"
  ADD COLUMN IF NOT EXISTS "evaluation_id" INTEGER;

ALTER TABLE "Proposal_Version"
  ADD COLUMN IF NOT EXISTS "reviewer_id" TEXT;

ALTER TABLE "Proposal_Version"
  ADD COLUMN IF NOT EXISTS "decided_at" TIMESTAMP(3);

-- Una evaluacion resuelve como maximo una version.
CREATE UNIQUE INDEX IF NOT EXISTS "Proposal_Version_evaluation_id_key"
  ON "Proposal_Version"("evaluation_id");

CREATE INDEX IF NOT EXISTS "Proposal_Version_reviewer_id_idx"
  ON "Proposal_Version"("reviewer_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Proposal_Version_evaluation_id_fkey'
  ) THEN
    ALTER TABLE "Proposal_Version"
      ADD CONSTRAINT "Proposal_Version_evaluation_id_fkey"
      FOREIGN KEY ("evaluation_id") REFERENCES "Proposal_Evaluation"("evaluation_id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Proposal_Version_reviewer_id_fkey'
  ) THEN
    ALTER TABLE "Proposal_Version"
      ADD CONSTRAINT "Proposal_Version_reviewer_id_fkey"
      FOREIGN KEY ("reviewer_id") REFERENCES "user"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Backfill de la version 1 (propuesta inicial)
-- ---------------------------------------------------------------------------
WITH candidates AS (
  SELECT
    p.project_id,
    COALESCE(
      (
        SELECT pu.user_id FROM "Project_User" pu
        WHERE pu.project_id = p.project_id
          AND pu.project_role = 'Principal_Investigator'
        LIMIT 1
      ),
      (
        SELECT pu.user_id FROM "Project_User" pu
        WHERE pu.project_id = p.project_id
        LIMIT 1
      )
    ) AS submitter_id,
    (
      SELECT MIN(d.uploaded_at) FROM "ProjectDocument" d
      WHERE d.project_id = p.project_id AND d.doc_type <> 'evidence'
    ) AS first_document_at,
    e.evaluation_id AS first_evaluation_id,
    e.decision AS first_decision,
    e.justification AS first_justification,
    e.reviewer_id AS first_reviewer_id,
    e.created_at AS first_decided_at,
    p.status AS project_status,
    p.status_changed_at
  FROM "Project" p
  LEFT JOIN LATERAL (
    SELECT ev.evaluation_id, ev.decision::text AS decision,
           ev.justification, ev.reviewer_id, ev.created_at
    FROM "Proposal_Evaluation" ev
    WHERE ev.project_id = p.project_id
    ORDER BY ev.created_at ASC
    LIMIT 1
  ) e ON TRUE
  WHERE p.status <> 'Draft'
    AND EXISTS (
      SELECT 1 FROM "ProjectDocument" d
      WHERE d.project_id = p.project_id AND d.doc_type <> 'evidence'
    )
)
INSERT INTO "Proposal_Version" (
  "project_id",
  "version_number",
  "submitted_by",
  "submitted_at",
  "status",
  "committee_comments",
  "evaluation_id",
  "reviewer_id",
  "decided_at"
)
SELECT
  c.project_id,
  1,
  c.submitter_id,
  COALESCE(c.first_document_at, c.status_changed_at, CURRENT_TIMESTAMP),
  (
    CASE
      WHEN c.first_decision = 'Approved' THEN 'Approved'
      WHEN c.first_decision = 'Rejected' THEN 'Rejected'
      WHEN c.first_decision = 'Revision_Required' THEN 'Under_Review'
      WHEN c.project_status IN ('Approved', 'Active', 'Completed', 'Closed') THEN 'Approved'
      WHEN c.project_status = 'Rejected' THEN 'Rejected'
      ELSE 'Under_Review'
    END
  )::"ProjectStatus",
  c.first_justification,
  c.first_evaluation_id,
  c.first_reviewer_id,
  c.first_decided_at
FROM candidates c
WHERE c.submitter_id IS NOT NULL
ON CONFLICT ("project_id", "version_number") DO NOTHING;

-- Vincular los documentos de registro (no evidencia) con la version 1.
UPDATE "ProjectDocument" d
SET "proposal_version_id" = v."version_id"
FROM "Proposal_Version" v
WHERE d."project_id" = v."project_id"
  AND v."version_number" = 1
  AND d."proposal_version_id" IS NULL
  AND d."doc_type" <> 'evidence';
