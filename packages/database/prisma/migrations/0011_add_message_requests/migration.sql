-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'MESSAGE_REQUEST_RECEIVED';
ALTER TYPE "NotificationType" ADD VALUE 'MESSAGE_REQUEST_ACCEPTED';
ALTER TYPE "NotificationType" ADD VALUE 'MESSAGE_REQUEST_DECLINED';

-- CreateEnum
CREATE TYPE "MessageRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "message_requests" (
    "id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "recipient_id" UUID NOT NULL,
    "conversation_id" UUID,
    "initial_message" VARCHAR(500) NOT NULL,
    "status" "MessageRequestStatus" NOT NULL DEFAULT 'PENDING',
    "declined_reason" VARCHAR(255),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "responded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "message_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "message_requests_recipient_id_status_created_at_idx" ON "message_requests"("recipient_id", "status", "created_at" DESC);
CREATE INDEX "message_requests_sender_id_status_created_at_idx" ON "message_requests"("sender_id", "status", "created_at" DESC);
CREATE INDEX "message_requests_status_expires_at_idx" ON "message_requests"("status", "expires_at");

-- Partial Unique Index: Exactly one PENDING request per sender-recipient pair
CREATE UNIQUE INDEX "idx_message_requests_unique_pending" ON "message_requests"("sender_id", "recipient_id") WHERE "status" = 'PENDING';

-- Cooldown Index: Efficient lookup of 30-day decline cooldown
CREATE INDEX "idx_message_requests_decline_cooldown" ON "message_requests"("sender_id", "recipient_id", "responded_at" DESC) WHERE "status" = 'DECLINED';

-- AddForeignKey
ALTER TABLE "message_requests" ADD CONSTRAINT "message_requests_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_requests" ADD CONSTRAINT "message_requests_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_requests" ADD CONSTRAINT "message_requests_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
