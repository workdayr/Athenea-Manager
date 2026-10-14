-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('Principal_Investigator', 'Student', 'Coordinator', 'Committee', 'Administrator');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('Proposed', 'Under_Review', 'Approved', 'Active', 'Completed', 'Closed', 'Rejected', 'Suspended');

-- CreateEnum
CREATE TYPE "ProjectRole" AS ENUM ('Principal_Investigator', 'Co_Investigator', 'Assistant');

-- CreateEnum
CREATE TYPE "DocType" AS ENUM ('hypothesis', 'abstract', 'methodology', 'rationale', 'results', 'ethics_approval');

-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('Team_only', 'Shared_with_administration');

-- CreateEnum
CREATE TYPE "MilestoneStatus" AS ENUM ('Pending', 'Completed', 'Delayed');

-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('journal_article', 'conference_presentation', 'software', 'patent', 'thesis');

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(1536),
    "roleAccess" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Users" (
    "user_id" SERIAL NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "mail" TEXT NOT NULL,
    "password" VARCHAR(64) NOT NULL,
    "role" "UserRole" NOT NULL,
    "failed_attempts" INTEGER DEFAULT 0,

    CONSTRAINT "Users_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "call_id" SERIAL NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "date_published" TIMESTAMP,
    "deadline" TIMESTAMP NOT NULL,
    "description" TEXT NOT NULL,
    "application_cap" INTEGER NOT NULL,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("call_id")
);

-- CreateTable
CREATE TABLE "Project" (
    "project_id" SERIAL NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "objectives" TEXT NOT NULL,
    "start_date" TIMESTAMP NOT NULL,
    "end_date" TIMESTAMP NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'Proposed',
    "budget_enabled" BOOLEAN NOT NULL DEFAULT false,
    "is_confidential" BOOLEAN NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("project_id")
);

-- CreateTable
CREATE TABLE "Project_User" (
    "projectuser_id" SERIAL NOT NULL,
    "project_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "project_role" "ProjectRole" NOT NULL,

    CONSTRAINT "Project_User_pkey" PRIMARY KEY ("projectuser_id")
);

-- CreateTable
CREATE TABLE "ProjectDocument" (
    "document_id" SERIAL NOT NULL,
    "project_id" INTEGER NOT NULL,
    "doc_type" "DocType" NOT NULL,
    "visibility" "Visibility" NOT NULL,
    "file_url" TEXT NOT NULL,
    "version" INTEGER NOT NULL,

    CONSTRAINT "ProjectDocument_pkey" PRIMARY KEY ("document_id")
);

-- CreateTable
CREATE TABLE "Milestone" (
    "milestone_id" SERIAL NOT NULL,
    "project_id" INTEGER NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "assignee_id" INTEGER NOT NULL,
    "due_date" DATE NOT NULL,
    "status" "MilestoneStatus" NOT NULL,

    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("milestone_id")
);

-- CreateTable
CREATE TABLE "Product" (
    "product_id" SERIAL NOT NULL,
    "project_id" INTEGER NOT NULL,
    "product_type" "ProductType" NOT NULL,
    "url_doi" TEXT NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("product_id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "expense_id" SERIAL NOT NULL,
    "project_id" INTEGER NOT NULL,
    "amount" DECIMAL(9,2) NOT NULL,
    "expense_description" VARCHAR(255) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("expense_id")
);

-- CreateTable
CREATE TABLE "Audit_Log" (
    "log_id" SERIAL NOT NULL,
    "actor_id" INTEGER NOT NULL,
    "action" VARCHAR(255) NOT NULL,
    "target_id" VARCHAR(255) NOT NULL,
    "source_ip" TEXT NOT NULL,
    "timestamp" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Audit_Log_pkey" PRIMARY KEY ("log_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Users_mail_key" ON "Users"("mail");

-- AddForeignKey
ALTER TABLE "Project_User" ADD CONSTRAINT "Project_User_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("project_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project_User" ADD CONSTRAINT "Project_User_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "Users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectDocument" ADD CONSTRAINT "ProjectDocument_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("project_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("project_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "Users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("project_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("project_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Audit_Log" ADD CONSTRAINT "Audit_Log_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "Users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
