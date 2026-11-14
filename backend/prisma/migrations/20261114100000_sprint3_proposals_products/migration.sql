-- Sprint 3 (F1-03 y F1-04): versiones de propuesta y productos de investigacion.
--
-- 1) Proposal_Version: historial inmutable de propuestas (RF-004 / UC-004).
-- 2) ProjectDocument.version_id: vincula el documento con su version de propuesta.
-- 3) Product: titulo opcional y Product_Author para autores ordenados (RF-007 / BR-009).
--
-- Idempotente: seguro para reejecuciones en PostgreSQL.

CREATE TABLE IF NOT EXISTS "Proposal_Version" (
  "version_id"         SERIAL NOT NULL,
  "project_id"         INTEGER NOT NULL,
  "version_number"     INTEGER NOT NULL,
  "submitted_by"       TEXT NOT NULL,
  "submitted_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status"             "ProjectStatus" NOT NULL DEFAULT 'Under_Review',
  "committee_comments" TEXT,
  "created_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Proposal_Version_pkey" PRIMARY KEY ("version_id")
);

-- Indice unico: maximo una version N por proyecto
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'Proposal_Version_project_id_version_number_key'
  ) THEN
    CREATE UNIQUE INDEX "Proposal_Version_project_id_version_number_key"
      ON "Proposal_Version"("project_id", "version_number");
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Proposal_Version_project_id_created_at_idx"
  ON "Proposal_Version"("project_id", "created_at");

CREATE INDEX IF NOT EXISTS "Proposal_Version_submitted_by_idx"
  ON "Proposal_Version"("submitted_by");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Proposal_Version_project_id_fkey'
  ) THEN
    ALTER TABLE "Proposal_Version"
      ADD CONSTRAINT "Proposal_Version_project_id_fkey"
      FOREIGN KEY ("project_id") REFERENCES "Project"("project_id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Proposal_Version_submitted_by_fkey'
  ) THEN
    ALTER TABLE "Proposal_Version"
      ADD CONSTRAINT "Proposal_Version_submitted_by_fkey"
      FOREIGN KEY ("submitted_by") REFERENCES "user"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- Vincular ProjectDocument con la version de propuesta si aplica
ALTER TABLE "ProjectDocument"
  ADD COLUMN IF NOT EXISTS "proposal_version_id" INTEGER;

CREATE INDEX IF NOT EXISTS "ProjectDocument_proposal_version_id_idx"
  ON "ProjectDocument"("proposal_version_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ProjectDocument_proposal_version_id_fkey'
  ) THEN
    ALTER TABLE "ProjectDocument"
      ADD CONSTRAINT "ProjectDocument_proposal_version_id_fkey"
      FOREIGN KEY ("proposal_version_id") REFERENCES "Proposal_Version"("version_id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- F1-04: extension de Product y tabla Product_Author
ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "title" VARCHAR(300);

ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS "Product_Author" (
  "author_id"    SERIAL NOT NULL,
  "product_id"   INTEGER NOT NULL,
  "user_id"      TEXT NOT NULL,
  "author_order" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "Product_Author_pkey" PRIMARY KEY ("author_id")
);

CREATE INDEX IF NOT EXISTS "Product_Author_product_id_author_order_idx"
  ON "Product_Author"("product_id", "author_order");

CREATE INDEX IF NOT EXISTS "Product_Author_user_id_idx"
  ON "Product_Author"("user_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Product_Author_product_id_fkey'
  ) THEN
    ALTER TABLE "Product_Author"
      ADD CONSTRAINT "Product_Author_product_id_fkey"
      FOREIGN KEY ("product_id") REFERENCES "Product"("product_id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Product_Author_user_id_fkey'
  ) THEN
    ALTER TABLE "Product_Author"
      ADD CONSTRAINT "Product_Author_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "user"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
