-- CreateEnum
CREATE TYPE "CommunityPostType" AS ENUM ('ANNOUNCEMENT', 'OPPORTUNITY', 'DISCUSSION', 'EVENT', 'QUESTION');
CREATE TYPE "CommunityPostStatus" AS ENUM ('ACTIVE', 'HIDDEN', 'DELETED');
CREATE TYPE "CommunityEventStatus" AS ENUM ('UPCOMING', 'ONGOING', 'COMPLETED', 'CANCELLED');
CREATE TYPE "EventRsvpStatus" AS ENUM ('CONFIRMED', 'CANCELLED');

-- CreateTable: community_events
CREATE TABLE "community_events" (
    "id" UUID NOT NULL,
    "organizer_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL,
    "city" VARCHAR(50) NOT NULL DEFAULT 'Mumbai',
    "venue" VARCHAR(255) NOT NULL,
    "event_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "is_official" BOOLEAN NOT NULL DEFAULT false,
    "capacity" INTEGER,
    "rsvp_count" INTEGER NOT NULL DEFAULT 0,
    "status" "CommunityEventStatus" NOT NULL DEFAULT 'UPCOMING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "community_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable: community_posts
CREATE TABLE "community_posts" (
    "id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "type" "CommunityPostType" NOT NULL DEFAULT 'DISCUSSION',
    "title" VARCHAR(200) NOT NULL,
    "body" TEXT NOT NULL,
    "city" VARCHAR(50) NOT NULL DEFAULT 'Mumbai',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "status" "CommunityPostStatus" NOT NULL DEFAULT 'ACTIVE',
    "linked_assignment_id" UUID,
    "linked_event_id" UUID,
    "applauds_count" INTEGER NOT NULL DEFAULT 0,
    "comments_count" INTEGER NOT NULL DEFAULT 0,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "community_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable: community_comments
CREATE TABLE "community_comments" (
    "id" UUID NOT NULL,
    "post_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "applauds_count" INTEGER NOT NULL DEFAULT 0,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "community_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable: community_post_applauds
CREATE TABLE "community_post_applauds" (
    "id" UUID NOT NULL,
    "post_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "community_post_applauds_pkey" PRIMARY KEY ("id")
);

-- CreateTable: community_event_rsvps
CREATE TABLE "community_event_rsvps" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "EventRsvpStatus" NOT NULL DEFAULT 'CONFIRMED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "community_event_rsvps_pkey" PRIMARY KEY ("id")
);

-- CreateTable: community_hub_follows
CREATE TABLE "community_hub_follows" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "city" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "community_hub_follows_pkey" PRIMARY KEY ("id")
);

-- Indexes for community_events
CREATE INDEX "community_events_city_status_event_date_idx" ON "community_events"("city", "status", "event_date" ASC);
CREATE INDEX "community_events_organizer_id_idx" ON "community_events"("organizer_id");

-- Indexes for community_posts
CREATE INDEX "community_posts_city_status_is_pinned_created_at_idx" ON "community_posts"("city", "status", "is_pinned", "created_at" DESC);
CREATE INDEX "community_posts_author_id_status_created_at_idx" ON "community_posts"("author_id", "status", "created_at" DESC);
CREATE INDEX "community_posts_type_city_status_idx" ON "community_posts"("type", "city", "status");

-- Indexes for community_comments
CREATE INDEX "community_comments_post_id_created_at_idx" ON "community_comments"("post_id", "created_at" ASC);
CREATE INDEX "community_comments_author_id_idx" ON "community_comments"("author_id");

-- Constraints & Indexes for community_post_applauds
CREATE UNIQUE INDEX "community_post_applauds_post_id_user_id_key" ON "community_post_applauds"("post_id", "user_id");
CREATE INDEX "community_post_applauds_user_id_idx" ON "community_post_applauds"("user_id");

-- Constraints & Indexes for community_event_rsvps
CREATE UNIQUE INDEX "community_event_rsvps_event_id_user_id_key" ON "community_event_rsvps"("event_id", "user_id");
CREATE INDEX "community_event_rsvps_user_id_status_idx" ON "community_event_rsvps"("user_id", "status");

-- Constraints & Indexes for community_hub_follows
CREATE UNIQUE INDEX "community_hub_follows_user_id_city_key" ON "community_hub_follows"("user_id", "city");
CREATE INDEX "community_hub_follows_city_idx" ON "community_hub_follows"("city");

-- Foreign Keys for community_events
ALTER TABLE "community_events" ADD CONSTRAINT "community_events_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Foreign Keys for community_posts
ALTER TABLE "community_posts" ADD CONSTRAINT "community_posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "community_posts" ADD CONSTRAINT "community_posts_linked_assignment_id_fkey" FOREIGN KEY ("linked_assignment_id") REFERENCES "assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "community_posts" ADD CONSTRAINT "community_posts_linked_event_id_fkey" FOREIGN KEY ("linked_event_id") REFERENCES "community_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Foreign Keys for community_comments
ALTER TABLE "community_comments" ADD CONSTRAINT "community_comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "community_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "community_comments" ADD CONSTRAINT "community_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Foreign Keys for community_post_applauds
ALTER TABLE "community_post_applauds" ADD CONSTRAINT "community_post_applauds_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "community_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "community_post_applauds" ADD CONSTRAINT "community_post_applauds_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Foreign Keys for community_event_rsvps
ALTER TABLE "community_event_rsvps" ADD CONSTRAINT "community_event_rsvps_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "community_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "community_event_rsvps" ADD CONSTRAINT "community_event_rsvps_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Foreign Keys for community_hub_follows
ALTER TABLE "community_hub_follows" ADD CONSTRAINT "community_hub_follows_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
