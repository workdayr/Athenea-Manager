-- US 2.1 Project Creation: campos para registro de proyectos.
-- La BD ya contenia las tablas de dominio (migracion integracion_diccionario_datos
-- aplicada en Neon pero sin carpeta local); este archivo solo trae el delta.
-- Generado via: prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "call_id" INTEGER;

-- AlterTable
ALTER TABLE "ProjectDocument" ADD COLUMN     "file_name" TEXT,
ADD COLUMN     "file_size" INTEGER,
ADD COLUMN     "uploaded_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Project_User" ALTER COLUMN "user_id" SET DATA TYPE TEXT;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_call_id_fkey" FOREIGN KEY ("call_id") REFERENCES "Announcement"("call_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project_User" ADD CONSTRAINT "Project_User_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
