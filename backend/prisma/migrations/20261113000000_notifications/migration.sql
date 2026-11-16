-- RF-014: notificaciones in-app y cola persistente de correos.
--
-- 1) Enum NotificationType: eventos que generan una notificacion.
-- 2) Enum EmailStatus: ciclo de vida del correo en la outbox.
-- 3) Notification: bandeja por usuario (leida/no leida).
-- 4) Email_Outbox: envio asincrono con reintentos y backoff.
--
-- Idempotente: las migraciones DDL contra el pooler de Neon pueden fallar a
-- mitad de camino y reejecutarse.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'NotificationType'
  ) THEN
    CREATE TYPE "NotificationType" AS ENUM (
      'Decision',
      'Milestone',
      'Evidence',
      'Archive',
      'Role',
      'Invitation',
      'Deadline',
      'System'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'EmailStatus'
  ) THEN
    CREATE TYPE "EmailStatus" AS ENUM (
      'Pending',
      'Sent',
      'Failed',
      'Skipped'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "Notification" (
  "notification_id" SERIAL NOT NULL,
  "user_id"         TEXT NOT NULL,
  "type"            "NotificationType" NOT NULL,
  "title"           VARCHAR(200) NOT NULL,
  "message"         TEXT NOT NULL,
  "link"            VARCHAR(500),
  "read_at"         TIMESTAMP(3),
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("notification_id")
);

CREATE INDEX IF NOT EXISTS "Notification_user_id_read_at_created_at_idx"
  ON "Notification"("user_id", "read_at", "created_at");

CREATE INDEX IF NOT EXISTS "Notification_user_id_created_at_idx"
  ON "Notification"("user_id", "created_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Notification_user_id_fkey'
  ) THEN
    ALTER TABLE "Notification"
      ADD CONSTRAINT "Notification_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "user"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "Email_Outbox" (
  "email_id"        SERIAL NOT NULL,
  "notification_id" INTEGER,
  "recipient"       VARCHAR(320) NOT NULL,
  "subject"         VARCHAR(300) NOT NULL,
  "body"            TEXT NOT NULL,
  "status"          "EmailStatus" NOT NULL DEFAULT 'Pending',
  "attempts"        INTEGER NOT NULL DEFAULT 0,
  "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sent_at"         TIMESTAMP(3),
  "error"           TEXT,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Email_Outbox_pkey" PRIMARY KEY ("email_id")
);

CREATE INDEX IF NOT EXISTS "Email_Outbox_status_next_attempt_at_idx"
  ON "Email_Outbox"("status", "next_attempt_at");

CREATE INDEX IF NOT EXISTS "Email_Outbox_notification_id_idx"
  ON "Email_Outbox"("notification_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Email_Outbox_notification_id_fkey'
  ) THEN
    ALTER TABLE "Email_Outbox"
      ADD CONSTRAINT "Email_Outbox_notification_id_fkey"
      FOREIGN KEY ("notification_id") REFERENCES "Notification"("notification_id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
