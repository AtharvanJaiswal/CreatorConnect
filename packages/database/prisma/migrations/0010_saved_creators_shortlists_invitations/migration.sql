-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'INVITATION_RECEIVED';
ALTER TYPE "NotificationType" ADD VALUE 'INVITATION_ACCEPTED';
ALTER TYPE "NotificationType" ADD VALUE 'INVITATION_DECLINED';
ALTER TYPE "NotificationType" ADD VALUE 'INVITATION_WITHDRAWN';

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'WITHDRAWN', 'EXPIRED');

-- CreateTable
CREATE TABLE "saved_creators" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "creator_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_creators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shortlists" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "project_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shortlists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shortlist_members" (
    "id" UUID NOT NULL,
    "shortlist_id" UUID NOT NULL,
    "creator_id" UUID NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shortlist_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_invitations" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "inviter_id" UUID NOT NULL,
    "invitee_id" UUID NOT NULL,
    "shortlist_id" UUID,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3),
    "responded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "saved_creators_client_id_creator_id_key" ON "saved_creators"("client_id", "creator_id");
CREATE INDEX "saved_creators_client_id_created_at_idx" ON "saved_creators"("client_id", "created_at" DESC);
CREATE INDEX "saved_creators_creator_id_idx" ON "saved_creators"("creator_id");

-- CreateIndex
CREATE UNIQUE INDEX "shortlists_owner_id_name_key" ON "shortlists"("owner_id", "name");
CREATE INDEX "shortlists_owner_id_updated_at_idx" ON "shortlists"("owner_id", "updated_at" DESC);
CREATE INDEX "shortlists_project_id_idx" ON "shortlists"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "shortlist_members_shortlist_id_creator_id_key" ON "shortlist_members"("shortlist_id", "creator_id");
CREATE INDEX "shortlist_members_shortlist_id_created_at_idx" ON "shortlist_members"("shortlist_id", "created_at" DESC);
CREATE INDEX "shortlist_members_creator_id_idx" ON "shortlist_members"("creator_id");

-- CreateIndex
CREATE INDEX "project_invitations_invitee_id_status_created_at_idx" ON "project_invitations"("invitee_id", "status", "created_at" DESC);
CREATE INDEX "project_invitations_inviter_id_status_created_at_idx" ON "project_invitations"("inviter_id", "status", "created_at" DESC);
CREATE INDEX "project_invitations_project_id_status_idx" ON "project_invitations"("project_id", "status");
CREATE INDEX "project_invitations_status_expires_at_idx" ON "project_invitations"("status", "expires_at");

-- AddForeignKey
ALTER TABLE "saved_creators" ADD CONSTRAINT "saved_creators_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "saved_creators" ADD CONSTRAINT "saved_creators_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shortlists" ADD CONSTRAINT "shortlists_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shortlists" ADD CONSTRAINT "shortlists_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shortlist_members" ADD CONSTRAINT "shortlist_members_shortlist_id_fkey" FOREIGN KEY ("shortlist_id") REFERENCES "shortlists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shortlist_members" ADD CONSTRAINT "shortlist_members_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_invitations" ADD CONSTRAINT "project_invitations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "project_invitations" ADD CONSTRAINT "project_invitations_inviter_id_fkey" FOREIGN KEY ("inviter_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "project_invitations" ADD CONSTRAINT "project_invitations_invitee_id_fkey" FOREIGN KEY ("invitee_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "project_invitations" ADD CONSTRAINT "project_invitations_shortlist_id_fkey" FOREIGN KEY ("shortlist_id") REFERENCES "shortlists"("id") ON DELETE SET NULL ON UPDATE CASCADE;
