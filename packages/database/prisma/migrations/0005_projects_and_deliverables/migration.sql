-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'PROJECT_CREATED';
ALTER TYPE "NotificationType" ADD VALUE 'DELIVERABLE_SUBMITTED';
ALTER TYPE "NotificationType" ADD VALUE 'DELIVERABLE_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'REVISION_REQUESTED';

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'REVISION_REQUESTED', 'APPROVED', 'COMPLETED', 'CANCELLED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "DeliverableStatus" AS ENUM ('PENDING', 'SUBMITTED', 'IN_REVIEW', 'APPROVED', 'REVISION_REQUESTED');

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL,
    "assignment_id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "talent_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "total_amount" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'INR',
    "status" "ProjectStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "version" INTEGER NOT NULL DEFAULT 1,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_deliverables" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "amount" INTEGER NOT NULL,
    "due_date" TIMESTAMPTZ(3),
    "status" "DeliverableStatus" NOT NULL DEFAULT 'PENDING',
    "version" INTEGER NOT NULL DEFAULT 1,
    "submitted_asset_id" UUID,
    "submission_notes" TEXT,
    "revision_notes" TEXT,
    "submitted_at" TIMESTAMP(3),
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_deliverables_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "projects_application_id_key" ON "projects"("application_id");

-- CreateIndex
CREATE INDEX "projects_client_id_status_idx" ON "projects"("client_id", "status");

-- CreateIndex
CREATE INDEX "projects_talent_id_status_idx" ON "projects"("talent_id", "status");

-- CreateIndex
CREATE INDEX "projects_assignment_id_idx" ON "projects"("assignment_id");

-- CreateIndex
CREATE INDEX "project_deliverables_project_id_status_idx" ON "project_deliverables"("project_id", "status");

-- CreateIndex
CREATE INDEX "project_deliverables_submitted_asset_id_idx" ON "project_deliverables"("submitted_asset_id");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_talent_id_fkey" FOREIGN KEY ("talent_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_deliverables" ADD CONSTRAINT "project_deliverables_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_deliverables" ADD CONSTRAINT "project_deliverables_submitted_asset_id_fkey" FOREIGN KEY ("submitted_asset_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
