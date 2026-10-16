-- US 2.2 / RF-018: estado y contador de postulaciones en convocatorias.
-- El contador + SELECT ... FOR UPDATE (ver calls.service.ts) serializan
-- las postulaciones concurrentes para no exceder application_cap.

-- CreateEnum
CREATE TYPE "CallStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED');

-- AlterTable
ALTER TABLE "Announcement" ADD COLUMN "status" "CallStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN "application_count" INTEGER NOT NULL DEFAULT 0;
