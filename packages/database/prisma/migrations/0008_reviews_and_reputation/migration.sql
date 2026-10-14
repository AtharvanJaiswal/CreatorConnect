-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'REVIEW_RECEIVED';
ALTER TYPE "NotificationType" ADD VALUE 'REVIEW_REPORTED';
ALTER TYPE "NotificationType" ADD VALUE 'REVIEW_MODERATED';

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PUBLISHED', 'FLAGGED', 'HIDDEN', 'REMOVED');

-- CreateEnum
CREATE TYPE "ReviewReportReason" AS ENUM ('SPAM', 'HARASSMENT', 'DEFAMATION', 'INAPPROPRIATE_CONTENT', 'CONFLICT_OF_INTEREST', 'OTHER');

-- CreateEnum
CREATE TYPE "ReviewReportStatus" AS ENUM ('PENDING', 'INVESTIGATING', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "ReviewModerationActionType" AS ENUM ('FLAG', 'HIDE', 'REMOVE', 'RESTORE');

-- CreateTable
CREATE TABLE "reviews" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "reviewer_id" UUID NOT NULL,
    "reviewee_id" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "communication_rating" INTEGER,
    "quality_rating" INTEGER,
    "adherence_rating" INTEGER,
    "feedback" TEXT NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PUBLISHED',
    "edit_count" INTEGER NOT NULL DEFAULT 0,
    "edited_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_reports" (
    "id" UUID NOT NULL,
    "review_id" UUID NOT NULL,
    "reporter_id" UUID NOT NULL,
    "reason" "ReviewReportReason" NOT NULL,
    "details" TEXT NOT NULL,
    "status" "ReviewReportStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_moderation_audits" (
    "id" UUID NOT NULL,
    "review_id" UUID NOT NULL,
    "moderator_id" UUID NOT NULL,
    "action_type" "ReviewModerationActionType" NOT NULL,
    "from_status" "ReviewStatus" NOT NULL,
    "to_status" "ReviewStatus" NOT NULL,
    "reason" TEXT NOT NULL,
    "internal_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_moderation_audits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reviews_project_id_reviewer_id_key" ON "reviews"("project_id", "reviewer_id");

-- CreateIndex
CREATE INDEX "reviews_reviewee_id_status_created_at_idx" ON "reviews"("reviewee_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "reviews_reviewer_id_created_at_idx" ON "reviews"("reviewer_id", "created_at");

-- CreateIndex
CREATE INDEX "reviews_project_id_idx" ON "reviews"("project_id");

-- CreateIndex
CREATE INDEX "reviews_status_created_at_idx" ON "reviews"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "review_reports_review_id_reporter_id_key" ON "review_reports"("review_id", "reporter_id");

-- CreateIndex
CREATE INDEX "review_reports_review_id_status_idx" ON "review_reports"("review_id", "status");

-- CreateIndex
CREATE INDEX "review_reports_reporter_id_idx" ON "review_reports"("reporter_id");

-- CreateIndex
CREATE INDEX "review_reports_status_created_at_idx" ON "review_reports"("status", "created_at");

-- CreateIndex
CREATE INDEX "review_moderation_audits_review_id_created_at_idx" ON "review_moderation_audits"("review_id", "created_at");

-- CreateIndex
CREATE INDEX "review_moderation_audits_moderator_id_idx" ON "review_moderation_audits"("moderator_id");

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reviewee_id_fkey" FOREIGN KEY ("reviewee_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_reports" ADD CONSTRAINT "review_reports_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_reports" ADD CONSTRAINT "review_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_moderation_audits" ADD CONSTRAINT "review_moderation_audits_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_moderation_audits" ADD CONSTRAINT "review_moderation_audits_moderator_id_fkey" FOREIGN KEY ("moderator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
