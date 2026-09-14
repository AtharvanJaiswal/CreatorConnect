-- CreateEnum
CREATE TYPE "ProfileVisibility" AS ENUM ('PUBLIC', 'UNLISTED', 'PRIVATE');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'IN_PROGRESS', 'COMPLETED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'SHORTLISTED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "BudgetType" AS ENUM ('FIXED', 'RANGE', 'HOURLY');

-- CreateEnum
CREATE TYPE "MediaAssetStatus" AS ENUM ('QUARANTINED', 'PENDING_SCAN', 'ACTIVE', 'REJECTED_INVALID', 'DELETED');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "SkillProficiency" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT');

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(64) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(255),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skills" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(64) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_skills" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "skill_id" UUID NOT NULL,
    "proficiency" "SkillProficiency" NOT NULL DEFAULT 'INTERMEDIATE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "creator_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "tagline" VARCHAR(160),
    "bio" TEXT,
    "location_country" VARCHAR(2),
    "location_city" VARCHAR(100),
    "is_remote" BOOLEAN NOT NULL DEFAULT true,
    "starting_rate" INTEGER,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'INR',
    "visibility" "ProfileVisibility" NOT NULL DEFAULT 'PUBLIC',
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "social_links" JSONB,
    "completion_score" INTEGER NOT NULL DEFAULT 0,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "creator_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "creator_profile_categories" (
    "creator_profile_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,

    CONSTRAINT "creator_profile_categories_pkey" PRIMARY KEY ("creator_profile_id","category_id")
);

-- CreateTable
CREATE TABLE "professional_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "headline" VARCHAR(160),
    "bio" TEXT,
    "years_experience" INTEGER,
    "day_rate" INTEGER,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'INR',
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "visibility" "ProfileVisibility" NOT NULL DEFAULT 'PUBLIC',
    "location_country" VARCHAR(2),
    "location_city" VARCHAR(100),
    "equipment_list" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "professional_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "company_name" VARCHAR(150) NOT NULL,
    "industry" VARCHAR(100),
    "website_url" VARCHAR(512),
    "company_size" VARCHAR(32),
    "bio" TEXT,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "visibility" "ProfileVisibility" NOT NULL DEFAULT 'PUBLIC',
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "podcaster_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "podcast_name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "rss_feed_url" VARCHAR(512),
    "guest_guidelines" TEXT,
    "visibility" "ProfileVisibility" NOT NULL DEFAULT 'PUBLIC',
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "podcaster_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portfolio_items" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "description" TEXT,
    "external_url" VARCHAR(512),
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "visibility" "ProfileVisibility" NOT NULL DEFAULT 'PUBLIC',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portfolio_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portfolio_media" (
    "id" UUID NOT NULL,
    "portfolio_item_id" UUID NOT NULL,
    "media_asset_id" UUID NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "caption" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portfolio_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_assets" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "storage_key" VARCHAR(512) NOT NULL,
    "thumbnail_key" VARCHAR(512),
    "preview_key" VARCHAR(512),
    "original_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "byte_size" INTEGER NOT NULL,
    "media_type" "MediaType" NOT NULL,
    "status" "MediaAssetStatus" NOT NULL DEFAULT 'QUARANTINED',
    "expires_at" TIMESTAMP(3),
    "width" INTEGER,
    "height" INTEGER,
    "duration_sec" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignments" (
    "id" UUID NOT NULL,
    "brand_id" UUID NOT NULL,
    "category_id" UUID,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL,
    "budget_type" "BudgetType" NOT NULL DEFAULT 'FIXED',
    "budget_min" INTEGER NOT NULL,
    "budget_max" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'INR',
    "deadline" TIMESTAMPTZ(3) NOT NULL,
    "is_remote" BOOLEAN NOT NULL DEFAULT true,
    "location" VARCHAR(150),
    "status" "AssignmentStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignment_requirements" (
    "id" UUID NOT NULL,
    "assignment_id" UUID NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "is_mandatory" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assignment_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applications" (
    "id" UUID NOT NULL,
    "assignment_id" UUID NOT NULL,
    "applicant_id" UUID NOT NULL,
    "cover_letter" TEXT NOT NULL,
    "proposed_rate" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'INR',
    "duration_days" INTEGER,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'SUBMITTED',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_status_history" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "from_status" "ApplicationStatus" NOT NULL,
    "to_status" "ApplicationStatus" NOT NULL,
    "actor_id" UUID NOT NULL,
    "reason" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "skills_slug_key" ON "skills"("slug");

-- CreateIndex
CREATE INDEX "user_skills_user_id_idx" ON "user_skills"("user_id");
CREATE INDEX "user_skills_skill_id_idx" ON "user_skills"("skill_id");
CREATE UNIQUE INDEX "user_skills_user_id_skill_id_key" ON "user_skills"("user_id", "skill_id");

-- CreateIndex
CREATE UNIQUE INDEX "creator_profiles_user_id_key" ON "creator_profiles"("user_id");
CREATE INDEX "creator_profiles_visibility_deleted_at_idx" ON "creator_profiles"("visibility", "deleted_at");
CREATE INDEX "creator_profiles_location_country_location_city_idx" ON "creator_profiles"("location_country", "location_city");

-- CreateIndex
CREATE UNIQUE INDEX "professional_profiles_user_id_key" ON "professional_profiles"("user_id");
CREATE INDEX "professional_profiles_visibility_deleted_at_idx" ON "professional_profiles"("visibility", "deleted_at");
CREATE INDEX "professional_profiles_is_available_idx" ON "professional_profiles"("is_available");

-- CreateIndex
CREATE UNIQUE INDEX "brand_profiles_user_id_key" ON "brand_profiles"("user_id");
CREATE INDEX "brand_profiles_visibility_deleted_at_idx" ON "brand_profiles"("visibility", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "podcaster_profiles_user_id_key" ON "podcaster_profiles"("user_id");
CREATE INDEX "podcaster_profiles_visibility_deleted_at_idx" ON "podcaster_profiles"("visibility", "deleted_at");

-- CreateIndex
CREATE INDEX "portfolio_items_user_id_display_order_idx" ON "portfolio_items"("user_id", "display_order");
CREATE INDEX "portfolio_items_visibility_deleted_at_idx" ON "portfolio_items"("visibility", "deleted_at");

-- CreateIndex
CREATE INDEX "portfolio_media_portfolio_item_id_display_order_idx" ON "portfolio_media"("portfolio_item_id", "display_order");
CREATE UNIQUE INDEX "portfolio_media_portfolio_item_id_media_asset_id_key" ON "portfolio_media"("portfolio_item_id", "media_asset_id");

-- CreateIndex
CREATE UNIQUE INDEX "media_assets_storage_key_key" ON "media_assets"("storage_key");
CREATE INDEX "media_assets_user_id_idx" ON "media_assets"("user_id");
CREATE INDEX "media_assets_status_idx" ON "media_assets"("status");

-- CreateIndex
CREATE INDEX "assignments_status_deleted_at_created_at_idx" ON "assignments"("status", "deleted_at", "created_at");
CREATE INDEX "assignments_brand_id_idx" ON "assignments"("brand_id");
CREATE INDEX "assignments_category_id_idx" ON "assignments"("category_id");
CREATE INDEX "assignments_budget_min_budget_max_idx" ON "assignments"("budget_min", "budget_max");

-- CreateIndex
CREATE INDEX "assignment_requirements_assignment_id_idx" ON "assignment_requirements"("assignment_id");

-- CreateIndex
CREATE INDEX "applications_assignment_id_status_idx" ON "applications"("assignment_id", "status");
CREATE INDEX "applications_applicant_id_status_idx" ON "applications"("applicant_id", "status");
CREATE UNIQUE INDEX "applications_assignment_id_applicant_id_key" ON "applications"("assignment_id", "applicant_id");

-- CreateIndex
CREATE INDEX "application_status_history_application_id_created_at_idx" ON "application_status_history"("application_id", "created_at");
CREATE INDEX "application_status_history_actor_id_idx" ON "application_status_history"("actor_id");

-- AddForeignKeys
ALTER TABLE "user_skills" ADD CONSTRAINT "user_skills_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_skills" ADD CONSTRAINT "user_skills_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "creator_profiles" ADD CONSTRAINT "creator_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "creator_profile_categories" ADD CONSTRAINT "creator_profile_categories_creator_profile_id_fkey" FOREIGN KEY ("creator_profile_id") REFERENCES "creator_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "creator_profile_categories" ADD CONSTRAINT "creator_profile_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "professional_profiles" ADD CONSTRAINT "professional_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "brand_profiles" ADD CONSTRAINT "brand_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "podcaster_profiles" ADD CONSTRAINT "podcaster_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "portfolio_items" ADD CONSTRAINT "portfolio_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "portfolio_media" ADD CONSTRAINT "portfolio_media_portfolio_item_id_fkey" FOREIGN KEY ("portfolio_item_id") REFERENCES "portfolio_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "portfolio_media" ADD CONSTRAINT "portfolio_media_media_asset_id_fkey" FOREIGN KEY ("media_asset_id") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "assignments" ADD CONSTRAINT "assignments_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brand_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "assignment_requirements" ADD CONSTRAINT "assignment_requirements_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "applications" ADD CONSTRAINT "applications_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "applications" ADD CONSTRAINT "applications_applicant_id_fkey" FOREIGN KEY ("applicant_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "application_status_history" ADD CONSTRAINT "application_status_history_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "application_status_history" ADD CONSTRAINT "application_status_history_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ==============================================================================
-- PostgreSQL CHECK Constraints & Money Bounds
-- ==============================================================================

-- 1. Monetary and Budget Bounds on Assignments
ALTER TABLE "assignments" 
  ADD CONSTRAINT "chk_assignments_budget_nonneg" CHECK (budget_min >= 0 AND budget_max >= 0),
  ADD CONSTRAINT "chk_assignments_budget_range" CHECK (budget_max >= budget_min),
  ADD CONSTRAINT "chk_assignments_budget_max_bound" CHECK (budget_max <= 1000000000);

-- 2. Monetary and Duration Bounds on Applications
ALTER TABLE "applications" 
  ADD CONSTRAINT "chk_applications_proposed_rate" CHECK (proposed_rate > 0 AND proposed_rate <= 1000000000),
  ADD CONSTRAINT "chk_applications_duration_positive" CHECK (duration_days IS NULL OR (duration_days > 0 AND duration_days <= 730));

-- 3. Profile Rates
ALTER TABLE "creator_profiles" 
  ADD CONSTRAINT "chk_creator_starting_rate" CHECK (starting_rate IS NULL OR (starting_rate >= 0 AND starting_rate <= 1000000000));

ALTER TABLE "professional_profiles" 
  ADD CONSTRAINT "chk_professional_day_rate" CHECK (day_rate IS NULL OR (day_rate >= 0 AND day_rate <= 1000000000));

-- ==============================================================================
-- Stored Generated tsvector Columns & GIN Indexes
-- ==============================================================================

-- Generated search vector for Assignments
ALTER TABLE "assignments" ADD COLUMN "search_vector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B')
  ) STORED;

CREATE INDEX "idx_assignments_search" ON "assignments" USING GIN("search_vector");

-- Generated search vector for Creator Profiles
ALTER TABLE "creator_profiles" ADD COLUMN "search_vector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(tagline, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(bio, '')), 'B')
  ) STORED;

CREATE INDEX "idx_creator_profiles_search" ON "creator_profiles" USING GIN("search_vector");

-- ==============================================================================
-- pg_trgm Extension & GIN Trigram Indexes
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "idx_assignments_title_trgm" ON "assignments" USING GIN("title" gin_trgm_ops);
CREATE INDEX "idx_creator_profiles_tagline_trgm" ON "creator_profiles" USING GIN("tagline" gin_trgm_ops);
CREATE INDEX "idx_skills_name_trgm" ON "skills" USING GIN("name" gin_trgm_ops);
