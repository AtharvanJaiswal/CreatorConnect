import { getPrismaClient } from '@creatorconnect/database';

export interface KeysetCursor {
  computedRank: number;
  createdAt: string;
  id: string;
}

export class DiscoveryRepository {
  constructor(private prisma = getPrismaClient()) {}

  async searchAssignments(params: {
    query?: string | undefined;
    categoryId?: string | undefined;
    budgetMin?: number | undefined;
    budgetMax?: number | undefined;
    isRemote?: boolean | undefined;
    location?: string | undefined;
    cursor?: KeysetCursor | undefined;
    limit: number;
  }) {
    // Ensure trigram similarity threshold is explicitly 0.3
    await this.prisma.$executeRawUnsafe(`SET LOCAL pg_trgm.similarity_threshold = 0.3;`);

    const hasQuery = Boolean(params.query && params.query.trim().length > 0);
    const q = params.query ? params.query.trim() : '';

    if (hasQuery) {
      const cursorRank = params.cursor ? params.cursor.computedRank : null;
      const cursorCreatedAt = params.cursor ? new Date(params.cursor.createdAt) : null;
      const cursorId = params.cursor ? params.cursor.id : null;

      const rows = await this.prisma.$queryRaw<any[]>`
        SELECT 
          a.id, a.brand_id, a.category_id, a.title, a.description, a.budget_type,
          a.budget_min, a.budget_max, a.currency, a.deadline, a.is_remote, a.location,
          a.status, a.version, a.created_at, a.updated_at,
          ROUND(
            (
              COALESCE(ts_rank(a.search_vector, plainto_tsquery('english', ${q})), 0.0) * 0.7 +
              similarity(a.title, ${q}) * 0.3
            )::numeric,
            4
          )::float8 AS computed_rank
        FROM assignments a
        WHERE a.status = 'PUBLISHED'
          AND a.deleted_at IS NULL
          AND a.deadline > NOW()
          AND (${params.categoryId}::uuid IS NULL OR a.category_id = ${params.categoryId}::uuid)
          AND (${params.budgetMin}::integer IS NULL OR a.budget_max >= ${params.budgetMin}::integer)
          AND (${params.budgetMax}::integer IS NULL OR a.budget_min <= ${params.budgetMax}::integer)
          AND (${params.isRemote}::boolean IS NULL OR a.is_remote = ${params.isRemote}::boolean)
          AND (${params.location}::text IS NULL OR a.location = ${params.location}::text)
          AND (
            a.search_vector @@ plainto_tsquery('english', ${q})
            OR a.title % ${q}
          )
          AND (
            (${cursorRank}::numeric IS NULL)
            OR (
              ROUND(
                (
                  COALESCE(ts_rank(a.search_vector, plainto_tsquery('english', ${q})), 0.0) * 0.7 +
                  similarity(a.title, ${q}) * 0.3
                )::numeric,
                4
              ) < ${cursorRank}::numeric
            )
            OR (
              ROUND(
                (
                  COALESCE(ts_rank(a.search_vector, plainto_tsquery('english', ${q})), 0.0) * 0.7 +
                  similarity(a.title, ${q}) * 0.3
                )::numeric,
                4
              ) = ${cursorRank}::numeric
              AND a.created_at < ${cursorCreatedAt}::timestamptz
            )
            OR (
              ROUND(
                (
                  COALESCE(ts_rank(a.search_vector, plainto_tsquery('english', ${q})), 0.0) * 0.7 +
                  similarity(a.title, ${q}) * 0.3
                )::numeric,
                4
              ) = ${cursorRank}::numeric
              AND a.created_at = ${cursorCreatedAt}::timestamptz
              AND a.id < ${cursorId}::uuid
            )
          )
        ORDER BY computed_rank DESC, a.created_at DESC, a.id DESC
        LIMIT ${params.limit + 1};
      `;
      return rows;
    }

    // Default chronological listing when no search term is entered
    const cursorCreatedAt = params.cursor ? new Date(params.cursor.createdAt) : null;
    const cursorId = params.cursor ? params.cursor.id : null;

    const rows = await this.prisma.$queryRaw<any[]>`
      SELECT 
        a.id, a.brand_id, a.category_id, a.title, a.description, a.budget_type,
        a.budget_min, a.budget_max, a.currency, a.deadline, a.is_remote, a.location,
        a.status, a.version, a.created_at, a.updated_at,
        0.0::float8 AS computed_rank
      FROM assignments a
      WHERE a.status = 'PUBLISHED'
        AND a.deleted_at IS NULL
        AND a.deadline > NOW()
        AND (${params.categoryId}::uuid IS NULL OR a.category_id = ${params.categoryId}::uuid)
        AND (${params.budgetMin}::integer IS NULL OR a.budget_max >= ${params.budgetMin}::integer)
        AND (${params.budgetMax}::integer IS NULL OR a.budget_min <= ${params.budgetMax}::integer)
        AND (${params.isRemote}::boolean IS NULL OR a.is_remote = ${params.isRemote}::boolean)
        AND (${params.location}::text IS NULL OR a.location = ${params.location}::text)
        AND (
          (${cursorCreatedAt}::timestamptz IS NULL)
          OR (a.created_at < ${cursorCreatedAt}::timestamptz)
          OR (a.created_at = ${cursorCreatedAt}::timestamptz AND a.id < ${cursorId}::uuid)
        )
      ORDER BY a.created_at DESC, a.id DESC
      LIMIT ${params.limit + 1};
    `;
    return rows;
  }

  async searchCreators(params: {
    query?: string | undefined;
    categoryId?: string | undefined;
    skillId?: string | undefined;
    locationCountry?: string | undefined;
    locationCity?: string | undefined;
    isRemote?: boolean | undefined;
    cursor?: KeysetCursor | undefined;
    limit: number;
  }) {
    await this.prisma.$executeRawUnsafe(`SET LOCAL pg_trgm.similarity_threshold = 0.3;`);

    const hasQuery = Boolean(params.query && params.query.trim().length > 0);
    const q = params.query ? params.query.trim() : '';

    if (hasQuery) {
      const cursorRank = params.cursor ? params.cursor.computedRank : null;
      const cursorCreatedAt = params.cursor ? new Date(params.cursor.createdAt) : null;
      const cursorId = params.cursor ? params.cursor.id : null;

      const rows = await this.prisma.$queryRaw<any[]>`
        SELECT 
          cp.id, cp.user_id, cp.tagline, cp.bio, cp.location_country, cp.location_city,
          cp.is_remote, cp.starting_rate, cp.currency, cp.visibility, cp.is_verified,
          cp.social_links, cp.completion_score, cp.created_at, cp.updated_at,
          ROUND(
            (
              COALESCE(ts_rank(cp.search_vector, plainto_tsquery('english', ${q})), 0.0) * 0.7 +
              similarity(coalesce(cp.tagline, ''), ${q}) * 0.3
            )::numeric,
            4
          )::float8 AS computed_rank
        FROM creator_profiles cp
        JOIN users u ON u.id = cp.user_id
        LEFT JOIN creator_profile_categories cpc ON cpc.creator_profile_id = cp.id
        LEFT JOIN user_skills us ON us.user_id = cp.user_id
        WHERE cp.visibility = 'PUBLIC'
          AND cp.deleted_at IS NULL
          AND u.status = 'ACTIVE'
          AND (${params.categoryId}::uuid IS NULL OR cpc.category_id = ${params.categoryId}::uuid)
          AND (${params.skillId}::uuid IS NULL OR us.skill_id = ${params.skillId}::uuid)
          AND (${params.locationCountry}::text IS NULL OR cp.location_country = ${params.locationCountry}::text)
          AND (${params.locationCity}::text IS NULL OR cp.location_city = ${params.locationCity}::text)
          AND (${params.isRemote}::boolean IS NULL OR cp.is_remote = ${params.isRemote}::boolean)
          AND (
            cp.search_vector @@ plainto_tsquery('english', ${q})
            OR cp.tagline % ${q}
          )
          AND (
            (${cursorRank}::numeric IS NULL)
            OR (
              ROUND(
                (
                  COALESCE(ts_rank(cp.search_vector, plainto_tsquery('english', ${q})), 0.0) * 0.7 +
                  similarity(coalesce(cp.tagline, ''), ${q}) * 0.3
                )::numeric,
                4
              ) < ${cursorRank}::numeric
            )
            OR (
              ROUND(
                (
                  COALESCE(ts_rank(cp.search_vector, plainto_tsquery('english', ${q})), 0.0) * 0.7 +
                  similarity(coalesce(cp.tagline, ''), ${q}) * 0.3
                )::numeric,
                4
              ) = ${cursorRank}::numeric
              AND cp.created_at < ${cursorCreatedAt}::timestamptz
            )
            OR (
              ROUND(
                (
                  COALESCE(ts_rank(cp.search_vector, plainto_tsquery('english', ${q})), 0.0) * 0.7 +
                  similarity(coalesce(cp.tagline, ''), ${q}) * 0.3
                )::numeric,
                4
              ) = ${cursorRank}::numeric
              AND cp.created_at = ${cursorCreatedAt}::timestamptz
              AND cp.id < ${cursorId}::uuid
            )
          )
        GROUP BY cp.id, u.id
        ORDER BY computed_rank DESC, cp.created_at DESC, cp.id DESC
        LIMIT ${params.limit + 1};
      `;
      return rows;
    }

    const cursorCreatedAt = params.cursor ? new Date(params.cursor.createdAt) : null;
    const cursorId = params.cursor ? params.cursor.id : null;

    const rows = await this.prisma.$queryRaw<any[]>`
      SELECT 
        cp.id, cp.user_id, cp.tagline, cp.bio, cp.location_country, cp.location_city,
        cp.is_remote, cp.starting_rate, cp.currency, cp.visibility, cp.is_verified,
        cp.social_links, cp.completion_score, cp.created_at, cp.updated_at,
        0.0::float8 AS computed_rank
      FROM creator_profiles cp
      JOIN users u ON u.id = cp.user_id
      LEFT JOIN creator_profile_categories cpc ON cpc.creator_profile_id = cp.id
      LEFT JOIN user_skills us ON us.user_id = cp.user_id
      WHERE cp.visibility = 'PUBLIC'
        AND cp.deleted_at IS NULL
        AND u.status = 'ACTIVE'
        AND (${params.categoryId}::uuid IS NULL OR cpc.category_id = ${params.categoryId}::uuid)
        AND (${params.skillId}::uuid IS NULL OR us.skill_id = ${params.skillId}::uuid)
        AND (${params.locationCountry}::text IS NULL OR cp.location_country = ${params.locationCountry}::text)
        AND (${params.locationCity}::text IS NULL OR cp.location_city = ${params.locationCity}::text)
        AND (${params.isRemote}::boolean IS NULL OR cp.is_remote = ${params.isRemote}::boolean)
        AND (
          (${cursorCreatedAt}::timestamptz IS NULL)
          OR (cp.created_at < ${cursorCreatedAt}::timestamptz)
          OR (cp.created_at = ${cursorCreatedAt}::timestamptz AND cp.id < ${cursorId}::uuid)
        )
      GROUP BY cp.id, u.id
      ORDER BY cp.created_at DESC, cp.id DESC
      LIMIT ${params.limit + 1};
    `;
    return rows;
  }
}

export const discoveryRepository = new DiscoveryRepository();
