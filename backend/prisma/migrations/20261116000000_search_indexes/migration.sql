-- F2-01 / RF-012: busqueda interna con PostgreSQL FTS.
-- Columnas generadas (no se mapean en Prisma) e indices GIN. Idempotente.

ALTER TABLE "Project"
  ADD COLUMN IF NOT EXISTS "search_vector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('spanish', coalesce("title", '')), 'A') ||
    setweight(to_tsvector('spanish', coalesce("objectives", '')), 'B')
  ) STORED;

CREATE INDEX IF NOT EXISTS "Project_search_vector_idx"
  ON "Project" USING GIN ("search_vector");

ALTER TABLE "Announcement"
  ADD COLUMN IF NOT EXISTS "search_vector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('spanish', coalesce("title", '')), 'A') ||
    setweight(to_tsvector('spanish', coalesce("description", '')), 'B')
  ) STORED;

CREATE INDEX IF NOT EXISTS "Announcement_search_vector_idx"
  ON "Announcement" USING GIN ("search_vector");

ALTER TABLE "user"
  ADD COLUMN IF NOT EXISTS "search_vector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('spanish', coalesce("name", '')), 'A') ||
    setweight(to_tsvector('spanish', coalesce("email", '')), 'B')
  ) STORED;

CREATE INDEX IF NOT EXISTS "user_search_vector_idx"
  ON "user" USING GIN ("search_vector");
