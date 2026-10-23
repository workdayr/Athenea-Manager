-- US 4.1 / RF-005: la visibilidad de los documentos de revision
-- obligatoria (protocolo metodologico y aprobacion del comite de etica)
-- no puede quedar restringida al equipo.
--
-- 1) Sanea registros historicos que pudieran estar en Team_only.
-- 2) Agrega una restriccion a nivel de BD como defensa en profundidad
--    frente a escrituras que no pasen por el servicio.
--
-- Idempotente: segura ante reintentos tras un fallo parcial.

UPDATE "ProjectDocument"
SET "visibility" = 'Shared_with_administration'
WHERE "doc_type"::text IN ('methodology', 'ethics_approval')
  AND "visibility"::text = 'Team_only';

ALTER TABLE "ProjectDocument"
  DROP CONSTRAINT IF EXISTS "project_document_mandatory_visibility";

ALTER TABLE "ProjectDocument"
  ADD CONSTRAINT "project_document_mandatory_visibility"
  CHECK (
    "doc_type"::text NOT IN ('methodology', 'ethics_approval')
    OR "visibility"::text = 'Shared_with_administration'
  );
