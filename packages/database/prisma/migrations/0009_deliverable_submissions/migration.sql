-- CreateTable
CREATE TABLE "project_deliverable_submissions" (
    "id" UUID NOT NULL,
    "deliverable_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "submitted_by_id" UUID NOT NULL,
    "submitted_asset_id" UUID,
    "submission_notes" TEXT,
    "review_status" "DeliverableStatus" NOT NULL DEFAULT 'SUBMITTED',
    "reviewed_by_id" UUID,
    "review_notes" TEXT,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_deliverable_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "project_deliverable_submissions_deliverable_id_version_key" ON "project_deliverable_submissions"("deliverable_id", "version");

-- CreateIndex
CREATE INDEX "project_deliverable_submissions_deliverable_id_idx" ON "project_deliverable_submissions"("deliverable_id");

-- CreateIndex
CREATE INDEX "project_deliverable_submissions_submitted_by_id_idx" ON "project_deliverable_submissions"("submitted_by_id");

-- AddForeignKey
ALTER TABLE "project_deliverable_submissions" ADD CONSTRAINT "project_deliverable_submissions_deliverable_id_fkey" FOREIGN KEY ("deliverable_id") REFERENCES "project_deliverables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_deliverable_submissions" ADD CONSTRAINT "project_deliverable_submissions_submitted_by_id_fkey" FOREIGN KEY ("submitted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_deliverable_submissions" ADD CONSTRAINT "project_deliverable_submissions_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_deliverable_submissions" ADD CONSTRAINT "project_deliverable_submissions_submitted_asset_id_fkey" FOREIGN KEY ("submitted_asset_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
