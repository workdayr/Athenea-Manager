-- DropForeignKey
ALTER TABLE "Milestone" DROP CONSTRAINT "Milestone_assignee_id_fkey";

-- DropForeignKey
ALTER TABLE "Task" DROP CONSTRAINT "Task_assignee_id_fkey";

-- DropForeignKey
ALTER TABLE "Task" DROP CONSTRAINT "Task_milestone_id_fkey";

-- DropIndex
DROP INDEX "Milestone_project_id_idx";

-- AlterTable
ALTER TABLE "Expense" ALTER COLUMN "expense_date" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Milestone" ADD COLUMN     "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "status" SET DEFAULT 'Pending';

-- DropTable
DROP TABLE "Task";

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
