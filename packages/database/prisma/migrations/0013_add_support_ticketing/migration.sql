-- CreateEnum
CREATE TYPE "SupportTicketCategory" AS ENUM ('ESCROW_RECONCILIATION', 'PAYMENT_DISPUTE', 'CONTRACT_VALIDATION', 'ACCOUNT_ACCESS', 'TRUST_SAFETY', 'OTHER');
CREATE TYPE "SupportTicketPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');
CREATE TYPE "SupportTicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING_FOR_CUSTOMER', 'RESOLVED', 'CLOSED');
CREATE TYPE "SupportMessageAuthorRole" AS ENUM ('CUSTOMER', 'STAFF', 'SYSTEM');

-- CreateTable: support_tickets
CREATE TABLE "support_tickets" (
    "id" UUID NOT NULL,
    "ticket_number" VARCHAR(32) NOT NULL,
    "requester_id" UUID NOT NULL,
    "assigned_to_id" UUID,
    "category" "SupportTicketCategory" NOT NULL DEFAULT 'OTHER',
    "priority" "SupportTicketPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "SupportTicketStatus" NOT NULL DEFAULT 'OPEN',
    "subject" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL,
    "linked_assignment_id" UUID,
    "linked_project_id" UUID,
    "escrow_amount" INTEGER,
    "resolution_summary" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "resolved_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable: support_ticket_messages
CREATE TABLE "support_ticket_messages" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "author_role" "SupportMessageAuthorRole" NOT NULL DEFAULT 'CUSTOMER',
    "body" TEXT NOT NULL,
    "is_internal" BOOLEAN NOT NULL DEFAULT false,
    "media_asset_id" UUID,
    "attachment_name" VARCHAR(255),
    "attachment_size" VARCHAR(64),
    "attachment_type" VARCHAR(64),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_ticket_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable: support_ticket_audits
CREATE TABLE "support_ticket_audits" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "action" VARCHAR(64) NOT NULL,
    "from_status" "SupportTicketStatus",
    "to_status" "SupportTicketStatus",
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_ticket_audits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "support_tickets_ticket_number_key" ON "support_tickets"("ticket_number");
CREATE INDEX "support_tickets_requester_id_status_created_at_idx" ON "support_tickets"("requester_id", "status", "created_at" DESC);
CREATE INDEX "support_tickets_assigned_to_id_status_created_at_idx" ON "support_tickets"("assigned_to_id", "status", "created_at" DESC);
CREATE INDEX "support_tickets_status_priority_created_at_idx" ON "support_tickets"("status", "priority", "created_at" DESC);
CREATE INDEX "support_tickets_ticket_number_idx" ON "support_tickets"("ticket_number");

CREATE INDEX "support_ticket_messages_ticket_id_created_at_id_idx" ON "support_ticket_messages"("ticket_id", "created_at" ASC, "id" ASC);
CREATE INDEX "support_ticket_messages_author_id_idx" ON "support_ticket_messages"("author_id");

CREATE INDEX "support_ticket_audits_ticket_id_created_at_idx" ON "support_ticket_audits"("ticket_id", "created_at" ASC);
CREATE INDEX "support_ticket_audits_actor_id_idx" ON "support_ticket_audits"("actor_id");

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_linked_assignment_id_fkey" FOREIGN KEY ("linked_assignment_id") REFERENCES "assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_linked_project_id_fkey" FOREIGN KEY ("linked_project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "support_ticket_messages" ADD CONSTRAINT "support_ticket_messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "support_ticket_messages" ADD CONSTRAINT "support_ticket_messages_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "support_ticket_messages" ADD CONSTRAINT "support_ticket_messages_media_asset_id_fkey" FOREIGN KEY ("media_asset_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "support_ticket_audits" ADD CONSTRAINT "support_ticket_audits_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "support_ticket_audits" ADD CONSTRAINT "support_ticket_audits_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
