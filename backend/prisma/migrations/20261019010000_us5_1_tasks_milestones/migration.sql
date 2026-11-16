-- AlterTable
ALTER TABLE "Milestone" ALTER COLUMN "assignee_id" SET DATA TYPE TEXT;

-- CreateTable
CREATE TABLE "Task" (
    "task_id" SERIAL NOT NULL,
    "milestone_id" INTEGER NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "assignee_id" TEXT NOT NULL,
    "due_date" DATE NOT NULL,
    "status" "MilestoneStatus" NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("task_id")
);

-- CreateIndex
CREATE INDEX "Task_milestone_id_idx" ON "Task"("milestone_id");

-- CreateIndex
CREATE INDEX "Task_assignee_id_idx" ON "Task"("assignee_id");

-- CreateIndex
CREATE INDEX "Milestone_project_id_idx" ON "Milestone"("project_id");

-- CreateIndex
CREATE INDEX "Milestone_assignee_id_idx" ON "Milestone"("assignee_id");

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "Milestone"("milestone_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
