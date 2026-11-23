-- AlterTable
ALTER TABLE "conversation_participants" ADD COLUMN IF NOT EXISTS "last_delivered_sequence" BIGINT NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "conversation_participants_conversation_id_last_delivered_se_idx" ON "conversation_participants"("conversation_id", "last_delivered_sequence");
