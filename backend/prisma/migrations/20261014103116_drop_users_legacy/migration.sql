-- Elimina la tabla legacy "Users" del diccionario de datos.
-- La fuente de verdad de usuarios es la tabla "user" de BetterAuth.
-- Las FKs que apuntaban a "Users" se sueltan; las columnas
-- (Project_User.user_id, Milestone.assignee_id, Audit_Log.actor_id)
-- quedan como enteros huerfanos hasta vincularse a "user".
ALTER TABLE IF EXISTS "Project_User" DROP CONSTRAINT IF EXISTS "Project_User_user_id_fkey";
ALTER TABLE IF EXISTS "Milestone" DROP CONSTRAINT IF EXISTS "Milestone_assignee_id_fkey";
ALTER TABLE IF EXISTS "Audit_Log" DROP CONSTRAINT IF EXISTS "Audit_Log_actor_id_fkey";
DROP TABLE IF EXISTS "Users";
-- Enum usado solo por Users.role.
DROP TYPE IF EXISTS "UserRole";
