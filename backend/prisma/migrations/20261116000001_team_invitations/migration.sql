-- F2-02 / RF-011 / BR-010: invitaciones de equipo con declaracion de
-- ausencia de conflicto familiar y caducidad de 7 dias. Idempotente.

DO $$
BEGIN
  CREATE TYPE "InvitationStatus" AS ENUM ('Pending', 'Accepted', 'Revoked', 'Expired');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "Team_Invitation" (
  "invitation_id"       SERIAL PRIMARY KEY,
  "project_id"          INTEGER NOT NULL,
  "email"               VARCHAR(320) NOT NULL,
  "user_id"             TEXT,
  "project_role"        "ProjectRole" NOT NULL,
  "token"               VARCHAR(64) NOT NULL,
  "status"              "InvitationStatus" NOT NULL DEFAULT 'Pending',
  "expires_at"          TIMESTAMP NOT NULL,
  "created_by"          TEXT NOT NULL,
  "affidavit_signed_at" TIMESTAMP NOT NULL,
  "accepted_at"         TIMESTAMP,
  "created_at"          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Team_Invitation_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "Project"("project_id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Team_Invitation_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "user"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Team_Invitation_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "user"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "Team_Invitation_token_key"
  ON "Team_Invitation" ("token");
CREATE INDEX IF NOT EXISTS "Team_Invitation_project_id_status_idx"
  ON "Team_Invitation" ("project_id", "status");
CREATE INDEX IF NOT EXISTS "Team_Invitation_email_status_idx"
  ON "Team_Invitation" ("email", "status");
CREATE INDEX IF NOT EXISTS "Team_Invitation_expires_at_status_idx"
  ON "Team_Invitation" ("expires_at", "status");
