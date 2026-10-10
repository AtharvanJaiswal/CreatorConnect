-- AlterTable
ALTER TABLE "notifications" ADD COLUMN "event_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "notifications_user_id_event_id_key" ON "notifications"("user_id", "event_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_id_idx" ON "notifications"("user_id", "created_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "notifications_event_id_idx" ON "notifications"("event_id");
