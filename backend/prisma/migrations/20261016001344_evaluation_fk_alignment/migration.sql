-- Alinea las acciones referenciales con schema.prisma (delta detectado
-- via `prisma migrate diff --from-config-datasource --to-schema`).
-- US 2.1 definio ON DELETE CASCADE para Project_User.user_id; el
-- reintento idempotente de evaluation_schema lo dejo en NO ACTION.
-- Audit_Log.actor_id adopta el default de Prisma (RESTRICT/CASCADE,
-- coherente con la inmutabilidad de la bitacora RF-017).

-- DropForeignKey
ALTER TABLE "Audit_Log" DROP CONSTRAINT "Audit_Log_actor_id_fkey";

-- DropForeignKey
ALTER TABLE "Project_User" DROP CONSTRAINT "Project_User_user_id_fkey";

-- AddForeignKey
ALTER TABLE "Project_User" ADD CONSTRAINT "Project_User_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Audit_Log" ADD CONSTRAINT "Audit_Log_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
