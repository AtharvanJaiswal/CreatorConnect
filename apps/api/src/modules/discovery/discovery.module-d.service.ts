import { getPrismaClient } from '@creatorconnect/database';
import { generateUuidV7 } from '@creatorconnect/utils';
import type {
  DiscoverQuery,
  DiscoverResponse,
  AutocompleteResponse,
  RecommendationsResponse,
  HomeDashboardResponse,
  PublicProfileResponse,
  ConnectionRequestInput,
  ConnectionRequestResponse,
  ModuleDProfileCard,
} from '@creatorconnect/contracts';
import { redisCache } from '../../services/redis-cache.js';
import { ForbiddenError, BadRequestError, NotFoundError } from '../../errors/app-error.js';

export class DiscoveryModuleDService {
  constructor(private prisma = getPrismaClient()) {}

  // --------------------------------------------------------------------------
  // 1. GET /api/v1/home/dashboard
  // --------------------------------------------------------------------------
  async getHomeDashboard(userId?: string, requestedRole?: string): Promise<HomeDashboardResponse> {
    const role = (requestedRole || 'CREATOR').toUpperCase();

    // Check user completion if authenticated
    let completionPercentage = 100;
    let greetingName = 'Creator';

    if (userId) {
      try {
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          include: {
            creatorProfile: true,
            brandProfile: true,
          },
        });

        if (user) {
          const rawName = [user.firstName, user.lastName].filter(Boolean).join(' ');
          const emailPrefix = user.email ? (user.email.split('@')[0] ?? 'Creator') : 'Creator';
          greetingName = rawName || emailPrefix;
          if (role === 'CREATOR' && user.creatorProfile) {
            completionPercentage = user.creatorProfile.completionScore || 100;
          } else if (role === 'BRAND' && user.brandProfile) {
            completionPercentage = 100;
          }
        }
      } catch {
        // Fallback to default completion
      }
    }

    const recommendations = await this.getRealRecommendations(role, 4);

    if (role === 'BRAND') {
      const totalApplicants = userId
        ? await this.prisma.application
            .count({
              where: { assignment: { brand: { userId } } },
            })
            .catch(() => 0)
        : 0;

      const activeBriefs = userId
        ? await this.prisma.assignment
            .count({
              where: { brand: { userId }, status: 'PUBLISHED', deletedAt: null },
            })
            .catch(() => 0)
        : 0;

      const hiredCount = userId
        ? await this.prisma.application
            .count({
              where: { assignment: { brand: { userId } }, status: 'ACCEPTED' },
            })
            .catch(() => 0)
        : 0;

      const realBriefs = userId
        ? await this.prisma.assignment
            .findMany({
              where: { brand: { userId }, deletedAt: null },
              take: 5,
              orderBy: { createdAt: 'desc' },
              include: { applications: true },
            })
            .catch(() => [])
        : [];

      const campaignPipeline = realBriefs.map((b) => ({
        id: b.id,
        title: b.title,
        category: 'General',
        appliedCount: b.applications?.length || 0,
        maxApplicants: 50,
        daysLeft: Math.max(
          0,
          Math.ceil((new Date(b.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
        ),
        budgetFormatted: `₹${b.budgetMin.toLocaleString('en-IN')}–${b.budgetMax.toLocaleString('en-IN')}`,
        status: b.status,
      }));

      return {
        role: 'BRAND',
        completionPercentage,
        greeting: `Welcome back, ${greetingName} 👋`,
        stats: {
          totalApplicants,
          activeBriefs,
          hiredCount,
        },
        recommendations,
        campaignPipeline,
        featuredCreators: recommendations,
      };
    }

    // Default to CREATOR dashboard
    const openBriefsCount = await this.prisma.assignment
      .count({
        where: { status: 'PUBLISHED', deletedAt: null },
      })
      .catch(() => 0);

    const realOpps = await this.prisma.assignment
      .findMany({
        where: { status: 'PUBLISHED', deletedAt: null },
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { brand: { include: { user: true } } },
      })
      .catch(() => []);

    const opportunities = realOpps.map((b) => ({
      id: b.id,
      brandName: b.brand?.companyName || 'Brand Partner',
      brandAvatar:
        b.brand?.user?.avatarUrl ||
        'https://images.unsplash.com/photo-1544441893-675973e31985?w=150',
      isVerified: b.brand?.isVerified || false,
      title: b.title,
      category: 'General',
      deliverable: b.description ? b.description.slice(0, 50) : 'Deliverable Brief',
      budget: `₹${b.budgetMin.toLocaleString('en-IN')}–₹${b.budgetMax.toLocaleString('en-IN')}`,
      location: b.location || 'Remote',
      daysLeft: `${Math.max(0, Math.ceil((new Date(b.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))} days left`,
    }));

    return {
      role: 'CREATOR',
      completionPercentage,
      greeting: `Good morning, ${greetingName} 👋`,
      stats: {
        profileViews: 0,
        profileViewsTrend: 'Active',
        rating: 5.0,
        reviewCount: 0,
        openBriefsCount,
      },
      recommendations,
      opportunities,
    };
  }

  // --------------------------------------------------------------------------
  // 2. GET /api/v1/discover (with Redis 60s Caching)
  // --------------------------------------------------------------------------
  async discover(query: DiscoverQuery): Promise<DiscoverResponse> {
    const cacheKey = `discover:v1:${JSON.stringify(query)}`;
    const redisClient = redisCache.getClient();

    if (redisClient && redisCache.isRedisConnected()) {
      try {
        const cached = await redisClient.get(cacheKey);
        if (cached) {
          return JSON.parse(cached);
        }
      } catch {
        // Fallback to query
      }
    }

    const items = await this.getRealDiscoveryItems(query);
    const totalCount = items.length;

    const response: DiscoverResponse = {
      items,
      totalCount,
      nextCursor: null,
      hasMore: false,
    };

    if (redisClient && redisCache.isRedisConnected()) {
      try {
        await redisClient.setex(cacheKey, 60, JSON.stringify(response));
      } catch {
        // Silent fail
      }
    }

    return response;
  }

  // --------------------------------------------------------------------------
  // 3. GET /api/v1/search/autocomplete?q={prefix}
  // --------------------------------------------------------------------------
  async autocomplete(prefix: string): Promise<AutocompleteResponse> {
    const q = prefix.trim().toLowerCase();
    const allNiches = [
      'Fashion & Lifestyle',
      'Tech & AI',
      'Food & Dining',
      'Home & Decor',
      'Fitness & Wellness',
      'Travel & Adventure',
      'Beauty & Skincare',
      'Finance & Business',
    ];
    const allSkills = [
      'Reels Editing',
      'Cinematography',
      'Podcast Hosting',
      'Color Grading',
      'UGC Creation',
      'Voiceover',
      'Drone Pilot',
      'Thumbnail Design',
    ];
    const allLocations = [
      'Mumbai, Maharashtra',
      'Delhi NCR',
      'Bengaluru, Karnataka',
      'Hyderabad, Telangana',
      'Pune, Maharashtra',
      'Chennai, Tamil Nadu',
      'Kolkata, West Bengal',
    ];

    const niches = allNiches.filter((n) => n.toLowerCase().includes(q)).slice(0, 4);
    const skills = allSkills.filter((s) => s.toLowerCase().includes(q)).slice(0, 4);
    const locations = allLocations.filter((l) => l.toLowerCase().includes(q)).slice(0, 3);

    const userMatches = await this.prisma.user
      .findMany({
        where: {
          status: 'ACTIVE',
          OR: [
            { firstName: { contains: q, mode: 'insensitive' } },
            { lastName: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
          ],
        },
        take: 5,
        include: {
          creatorProfile: true,
          brandProfile: true,
          professionalProfile: true,
          podcasterProfile: true,
        },
      })
      .catch(() => []);

    const profiles = userMatches.map((u) => {
      const name =
        [u.firstName, u.lastName].filter(Boolean).join(' ') ||
        u.brandProfile?.companyName ||
        (u.email?.split('@')[0] ?? 'User');
      const handle = `@${u.email?.split('@')[0] ?? 'user'}`;
      const role = u.brandProfile
        ? 'BRAND'
        : u.professionalProfile
          ? 'PROFESSIONAL'
          : u.podcasterProfile
            ? 'PODCASTER'
            : 'CREATOR';
      return {
        id: u.id,
        name,
        handle,
        role,
        avatarUrl: u.avatarUrl || '',
      };
    });

    return {
      niches,
      skills,
      locations,
      profiles,
    };
  }

  // --------------------------------------------------------------------------
  // 4. GET /api/v1/discover/recommendations (Rule-based §13)
  // --------------------------------------------------------------------------
  async getRecommendations(role = 'CREATOR'): Promise<RecommendationsResponse> {
    const items = await this.getRealRecommendations(role, 8);
    return { items };
  }

  // --------------------------------------------------------------------------
  // 5. GET /api/v1/profile/:id
  // --------------------------------------------------------------------------
  async getPublicProfile(id: string, callerId?: string): Promise<PublicProfileResponse> {
    const resolvedId = (id === 'self' || id === 'me') && callerId ? callerId : id.trim();

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ id: resolvedId }, { supabaseAuthId: resolvedId }],
        status: 'ACTIVE',
      },
      include: {
        creatorProfile: {
          include: {
            categories: { include: { category: true } },
          },
        },
        brandProfile: true,
        professionalProfile: true,
        podcasterProfile: true,
        portfolioItems: {
          include: { media: { include: { mediaAsset: true } } },
        },
      },
    });

    if (!user) {
      throw new NotFoundError(`Profile not found for ID: ${id}`);
    }

    const isBrand = !!user.brandProfile;
    const isPro = !!user.professionalProfile;
    const isPodcaster = !!user.podcasterProfile;
    const roleStr = isBrand
      ? 'BRAND'
      : isPro
        ? 'PROFESSIONAL'
        : isPodcaster
          ? 'PODCASTER'
          : 'CREATOR';

    const city = user.creatorProfile?.locationCity || '';
    const state = user.creatorProfile?.locationCountry || '';
    const bio =
      user.creatorProfile?.bio || user.brandProfile?.bio || user.professionalProfile?.bio || '';
    const rating = 5.0;
    const reviewCount = 0;

    const portfolioItems = (user.portfolioItems || []).map((p: any) => ({
      id: p.id,
      title: p.title,
      description: p.description || '',
      mediaUrl: p.media?.[0]?.mediaAsset?.url || '',
      mediaType: p.media?.[0]?.mediaAsset?.mimeType?.startsWith('video') ? 'VIDEO' : 'IMAGE',
      likesCount: p.viewsCount || 0,
    }));

    const rawName = [user.firstName, user.lastName].filter(Boolean).join(' ');
    const emailPrefix = user.email ? (user.email.split('@')[0] ?? 'User') : 'User';
    const displayName = rawName || user.brandProfile?.companyName || emailPrefix;
    const handle = `@${emailPrefix}`;

    const startingRateNum = user.creatorProfile?.startingRate || 0;
    const ratePerDeliverable =
      startingRateNum > 0 ? `₹${startingRateNum.toLocaleString('en-IN')}` : 'Contact for pricing';

    const rawSocials = (user.creatorProfile?.socialLinks as any[]) || [];
    const mappedSocials = rawSocials.map((s: any) => ({
      platform: s.platform || 'Social',
      handle: s.handle || s.url || '',
      followersFormatted: s.followers ? `${s.followers}` : '',
      url: s.url || '',
    }));

    const tags = (user.creatorProfile?.categories || [])
      .map((c: any) => c.category?.name)
      .filter(Boolean);

    const res: PublicProfileResponse = {
      id: user.id,
      userId: user.id,
      name: displayName,
      handle,
      role: roleStr,
      avatarUrl: user.avatarUrl ?? '',
      coverUrl: '',
      isVerified: user.creatorProfile?.isVerified || user.brandProfile?.isVerified || false,
      city,
      state,
      bio,
      followersCount: 0,
      followersFormatted: '0',
      rating,
      reviewCount,
      collabsCompleted: 0,
      ratePerDeliverable,
      deliverableTags: tags,
      socialLinks: mappedSocials,
      portfolioItems,
    };

    if (isBrand) {
      const activeBriefs = await this.prisma.assignment
        .findMany({
          where: { brand: { userId: user.id }, status: 'PUBLISHED', deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 5,
        })
        .catch(() => []);

      res.activeBriefs = activeBriefs.map((b) => ({
        id: b.id,
        title: b.title,
        category: 'General',
        budgetFormatted: `₹${(b.budgetMin ?? 0).toLocaleString('en-IN')}${b.budgetMax ? `–₹${b.budgetMax.toLocaleString('en-IN')}` : ''}`,
        deadlineText: b.deadline ? `Due ${new Date(b.deadline).toLocaleDateString()}` : 'Open',
      }));
    }

    return res;
  }

  // --------------------------------------------------------------------------
  // 6. POST /api/v1/connections/request (with 5/day Free quota per SOW §17)
  // --------------------------------------------------------------------------
  async requestConnection(
    requesterId: string,
    input: ConnectionRequestInput,
  ): Promise<ConnectionRequestResponse> {
    const today = new Date().toISOString().split('T')[0];
    const quotaKey = `quota:connections:${requesterId}:${today}`;
    const redisClient = redisCache.getClient();

    let count = 0;
    if (redisClient && redisCache.isRedisConnected()) {
      try {
        const val = await redisClient.get(quotaKey);
        count = val ? parseInt(val, 10) : 0;
      } catch {
        count = 0;
      }
    }

    const DAILY_LIMIT = 5;
    if (count >= DAILY_LIMIT) {
      throw new ForbiddenError(
        'Daily connection quota reached (5/day for Free accounts). Upgrade to Creator Pro for unlimited outreach.',
      );
    }

    // Increment quota in Redis with 24-hour expiration
    if (redisClient && redisCache.isRedisConnected()) {
      try {
        await redisClient.incr(quotaKey);
        await redisClient.expire(quotaKey, 86400);
      } catch {
        // Continue
      }
    }

    const connectionId = generateUuidV7();

    // Create notification event in DB for target user if exists
    try {
      await this.prisma.notification.create({
        data: {
          id: generateUuidV7(),
          userId: input.targetUserId,
          type: 'SYSTEM_ANNOUNCEMENT',
          title: 'New Connection Request',
          body: input.note || 'Someone wants to connect with your profile.',
          data: { actionUrl: `/profile/${requesterId}` },
        },
      });
    } catch {
      // Notification record optional
    }

    return {
      success: true,
      connectionId,
      remainingQuota: Math.max(0, DAILY_LIMIT - (count + 1)),
    };
  }

  // --------------------------------------------------------------------------
  // 7. POST /api/v1/users/block
  // --------------------------------------------------------------------------
  async blockUser(
    blockerId: string,
    targetUserId: string,
    reason?: string,
  ): Promise<{ success: boolean }> {
    if (blockerId === targetUserId) {
      throw new BadRequestError('You cannot block your own account.');
    }

    await this.prisma.userBlock.upsert({
      where: {
        blockerId_blockedId: {
          blockerId,
          blockedId: targetUserId,
        },
      },
      update: { reason: reason ?? null },
      create: {
        id: generateUuidV7(),
        blockerId,
        blockedId: targetUserId,
        reason: reason ?? null,
      },
    });

    return { success: true };
  }

  // --------------------------------------------------------------------------
  // 8. POST /api/v1/reports
  // --------------------------------------------------------------------------
  async createReport(
    reporterId: string,
    targetId: string,
    targetType: string,
    categoryStr: string,
    details: string,
  ): Promise<{ success: boolean; reportId: string }> {
    const reportId = generateUuidV7();

    // Map category string to schema enum or default OTHER
    const categoryEnum = ['SPAM', 'FAKE_PROFILE', 'HARASSMENT', 'OFF_PLATFORM_PAYMENT'].includes(
      categoryStr,
    )
      ? (categoryStr as any)
      : 'OTHER';

    await this.prisma.report.create({
      data: {
        id: reportId,
        reporterId,
        targetId,
        targetType: targetType.toUpperCase(),
        category: categoryEnum,
        details,
        status: 'PENDING',
      },
    });

    return { success: true, reportId };
  }

  // --------------------------------------------------------------------------
  // Helper: Curated / Real Profiles for Module D Discovery & Recommendations
  // --------------------------------------------------------------------------
  private async getRealRecommendations(role: string, limit = 8): Promise<ModuleDProfileCard[]> {
    const isBrand = role === 'BRAND';
    const users = await this.prisma.user
      .findMany({
        where: {
          status: 'ACTIVE',
          ...(isBrand
            ? {
                OR: [
                  { creatorProfile: { isNot: null } },
                  { professionalProfile: { isNot: null } },
                  { podcasterProfile: { isNot: null } },
                ],
              }
            : {}),
        },
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          creatorProfile: {
            include: {
              categories: { include: { category: true } },
            },
          },
          brandProfile: true,
          professionalProfile: true,
          podcasterProfile: true,
          portfolioItems: {
            take: 3,
            include: { media: { include: { mediaAsset: true } } },
          },
        },
      })
      .catch(() => []);

    return users.map((u) => this.mapUserToProfileCard(u));
  }

  private async getRealDiscoveryItems(query: DiscoverQuery): Promise<ModuleDProfileCard[]> {
    const where: any = {
      status: 'ACTIVE',
    };

    if (query.role && query.role.toUpperCase() !== 'ALL') {
      const qRole = query.role.toUpperCase();
      if (qRole === 'BRAND') {
        where.brandProfile = { isNot: null };
      } else if (qRole === 'CREATOR') {
        where.creatorProfile = { isNot: null };
      } else if (qRole === 'PROFESSIONAL') {
        where.professionalProfile = { isNot: null };
      } else if (qRole === 'PODCASTER') {
        where.podcasterProfile = { isNot: null };
      }
    }

    if (query.city) {
      where.creatorProfile = { locationCity: { contains: query.city, mode: 'insensitive' } };
    }

    const searchParam = (query as any).search || (query as any).q;
    if (searchParam && typeof searchParam === 'string' && searchParam.trim()) {
      const s = searchParam.trim();
      where.OR = [
        { firstName: { contains: s, mode: 'insensitive' } },
        { lastName: { contains: s, mode: 'insensitive' } },
        { email: { contains: s, mode: 'insensitive' } },
      ];
    }

    const users = await this.prisma.user
      .findMany({
        where,
        take: 50,
        orderBy: { createdAt: 'desc' },
        include: {
          creatorProfile: {
            include: {
              categories: { include: { category: true } },
            },
          },
          brandProfile: true,
          professionalProfile: true,
          podcasterProfile: true,
          portfolioItems: {
            take: 3,
            include: { media: { include: { mediaAsset: true } } },
          },
        },
      })
      .catch(() => []);

    let items = users.map((u) => this.mapUserToProfileCard(u));

    if (query.verifiedOnly) {
      items = items.filter((i) => i.isVerified);
    }
    if (query.minRate !== undefined) {
      items = items.filter((i) => i.startingRate >= query.minRate!);
    }
    if (query.maxRate !== undefined) {
      items = items.filter((i) => i.startingRate <= query.maxRate!);
    }
    if (query.category) {
      const cat = query.category.toLowerCase();
      items = items.filter((i) => i.category.toLowerCase().includes(cat));
    }

    return items;
  }

  private mapUserToProfileCard(u: any): ModuleDProfileCard {
    const isBrand = !!u.brandProfile;
    const isPro = !!u.professionalProfile;
    const isPodcaster = !!u.podcasterProfile;
    const role = isBrand ? 'BRAND' : isPro ? 'PROFESSIONAL' : isPodcaster ? 'PODCASTER' : 'CREATOR';

    const rawName = [u.firstName, u.lastName].filter(Boolean).join(' ');
    const emailPrefix = u.email ? (u.email.split('@')[0] ?? 'User') : 'User';
    const name = rawName || u.brandProfile?.companyName || emailPrefix;
    const handle = `@${emailPrefix}`;

    const category =
      u.creatorProfile?.categories?.[0]?.category?.name ||
      u.creatorProfile?.categories?.[0]?.categoryName ||
      (isBrand ? 'Brand & Retail' : isPro ? 'Production' : 'General');

    const city = u.creatorProfile?.locationCity || '';
    const state = u.creatorProfile?.locationCountry || '';

    const startingRate = u.creatorProfile?.startingRate || 0;
    const rateRange = startingRate > 0 ? `₹${(startingRate / 1000).toFixed(0)}k+` : 'Custom';

    const deliverableTags = (u.creatorProfile?.categories || [])
      .map((c: any) => c.category?.name)
      .filter(Boolean);

    const thumbnails = (u.portfolioItems || [])
      .map((p: any) => p.media?.[0]?.mediaAsset?.url)
      .filter(Boolean)
      .slice(0, 2);

    return {
      id: u.id,
      userId: u.id,
      name,
      handle,
      role,
      avatarUrl: u.avatarUrl || '',
      category,
      city,
      state,
      rating: 5.0,
      reviewCount: 0,
      startingRate,
      rateRange,
      deliverableTags,
      followersCount: 0,
      followersFormatted: '0',
      isVerified: u.creatorProfile?.isVerified || u.brandProfile?.isVerified || false,
      isOnline: true,
      bioSnippet: u.creatorProfile?.bio || u.brandProfile?.bio || '',
      portfolioThumbnails: thumbnails,
    };
  }
}

export const discoveryModuleDService = new DiscoveryModuleDService();
