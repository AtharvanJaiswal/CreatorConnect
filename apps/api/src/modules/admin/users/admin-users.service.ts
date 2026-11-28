import { type PrismaClient, getPrismaClient, UserStatus, RoleType } from '@creatorconnect/database';
import { userRepository, type IUserRepository } from '../../../repositories/user.repository.js';
import type {
  AdminUserQuery,
  AdminUserListResponse,
  AdminUserListItem,
  AdminUserDetailsResponse,
} from '@creatorconnect/contracts';
import { NotFoundError } from '../../../errors/app-error.js';
import { sanitizeAuditMetadata } from '../audit/audit-sanitizer.js';

export class AdminUsersService {
  private prisma: PrismaClient;
  private userRepo: IUserRepository;

  constructor(prismaClient?: PrismaClient, repo?: IUserRepository) {
    this.prisma = prismaClient || getPrismaClient();
    this.userRepo = repo || userRepository;
  }

  private calculateProfileCompleteness(user: any): number {
    let score = 20; // Base registered score
    if (user.firstName && user.lastName) score += 20;
    if (user.avatarUrl) score += 10;

    const profile =
      user.creatorProfile || user.professionalProfile || user.brandProfile || user.podcasterProfile;

    if (profile) {
      if (profile.bio || profile.description || profile.tagline) score += 25;
      if (profile.categories && profile.categories.length > 0) score += 15;
    }

    if (user.portfolioItems && user.portfolioItems.length > 0) score += 10;
    return Math.min(score, 100);
  }

  private mapToAdminUserListItem(u: any): AdminUserListItem {
    const roles = u.userRoles.map((ur: any) => ur.role.name as RoleType);
    const adminRoles = u.adminUserRoles ? u.adminUserRoles.map((aur: any) => aur.role.name) : [];
    const isVerified = Boolean(u.creatorProfile?.isVerified || u.professionalProfile?.isVerified);
    const completeness = this.calculateProfileCompleteness(u);
    const totalProjects = (u._count?.clientProjects || 0) + (u._count?.talentProjects || 0);

    return {
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      status: u.status as UserStatus,
      roles,
      adminRoles: adminRoles.length > 0 ? adminRoles : undefined,
      isVerified,
      profileCompleteness: completeness,
      totalProjects,
      hasActiveHold: false,
      createdAt: u.createdAt.toISOString(),
      updatedAt: u.updatedAt.toISOString(),
    };
  }

  public async listUsers(query: AdminUserQuery): Promise<AdminUserListResponse> {
    const page = Math.max(query.page || 1, 1);
    const limit = Math.min(Math.max(query.limit || 20, 1), 100);
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.role) {
      where.userRoles = {
        some: {
          role: {
            name: query.role,
          },
        },
      };
    }

    if (query.search && query.search.trim()) {
      const term = query.search.trim();
      const isUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(term);

      if (isUuid) {
        where.id = term;
      } else {
        where.OR = [
          { email: { contains: term, mode: 'insensitive' } },
          { firstName: { contains: term, mode: 'insensitive' } },
          { lastName: { contains: term, mode: 'insensitive' } },
        ];
      }
    }

    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder || 'desc';
    const orderBy: any = { [sortBy]: sortOrder };

    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        include: {
          userRoles: { include: { role: true } },
          adminUserRoles: { include: { role: true } },
          creatorProfile: { select: { isVerified: true, bio: true } },
          professionalProfile: { select: { bio: true } },
          brandProfile: { select: { isVerified: true, bio: true } },
          podcasterProfile: { select: { description: true } },
          _count: {
            select: {
              clientProjects: true,
              talentProjects: true,
            },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
    ]);

    return {
      items: users.map((u) => this.mapToAdminUserListItem(u)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  public async getUserDetails(userId: string): Promise<AdminUserDetailsResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: { include: { role: true } },
        adminUserRoles: { include: { role: true } },
        creatorProfile: {
          include: {
            categories: { include: { category: true } },
          },
        },
        professionalProfile: true,
        brandProfile: true,
        podcasterProfile: true,
        portfolioItems: { take: 5 },
        reviewsReceived: {
          select: { rating: true },
        },
        _count: {
          select: {
            clientProjects: true,
            talentProjects: true,
            reviewsReceived: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundError(`User not found: ${userId}`);
    }

    // Calculate rating and financial stats
    const totalReviews = user._count.reviewsReceived;
    const averageRating =
      totalReviews > 0
        ? Number(
            (user.reviewsReceived.reduce((acc, r) => acc + r.rating, 0) / totalReviews).toFixed(2),
          )
        : 0;

    // Aggregate lifetime earnings / spend from payment intents
    const financialAggregate = await this.prisma.paymentIntent.aggregate({
      where: {
        clientId: userId,
        status: 'SUCCEEDED',
      },
      _sum: {
        amount: true,
      },
    });

    // Recent activity timeline
    const auditLogs = await this.prisma.auditLog.findMany({
      where: {
        OR: [{ entityId: userId }, { userId }],
      },
      orderBy: { createdAt: 'desc' },
      take: 15,
      select: {
        action: true,
        entity: true,
        createdAt: true,
        metadata: true,
      },
    });

    const userItem = this.mapToAdminUserListItem(user);

    return {
      user: userItem,
      profile:
        user.creatorProfile ||
        user.professionalProfile ||
        user.brandProfile ||
        user.podcasterProfile ||
        null,
      activityTimeline: auditLogs.map((l) => ({
        action: l.action,
        entity: l.entity,
        createdAt: l.createdAt.toISOString(),
        metadata: sanitizeAuditMetadata(l.metadata),
      })),
      stats: {
        projectsCount: user._count.clientProjects + user._count.talentProjects,
        reviewsCount: totalReviews,
        averageRating,
        lifetimeSpendOrEarningsMinor: (financialAggregate._sum?.amount || 0).toString(),
      },
    };
  }

  public async suspendUser(
    targetUserId: string,
    reason: string,
    adminUserId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AdminUserListItem> {
    await this.userRepo.updateStatus(
      targetUserId,
      UserStatus.SUSPENDED,
      adminUserId,
      ipAddress,
      userAgent,
    );

    // Record explicit suspension reason audit log
    await this.prisma.auditLog.create({
      data: {
        id: (await import('@creatorconnect/utils')).generateUuidV7(),
        userId: adminUserId,
        action: 'ADMIN_USER_SUSPENDED',
        entity: 'User',
        entityId: targetUserId,
        ipAddress: ipAddress ?? null,
        userAgent: userAgent ?? null,
        metadata: {
          targetUserId,
          reason,
          newStatus: 'SUSPENDED',
        },
      },
    });

    return await this.getUserItem(targetUserId);
  }

  public async reactivateUser(
    targetUserId: string,
    reason: string,
    adminUserId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AdminUserListItem> {
    await this.userRepo.updateStatus(
      targetUserId,
      UserStatus.ACTIVE,
      adminUserId,
      ipAddress,
      userAgent,
    );

    await this.prisma.auditLog.create({
      data: {
        id: (await import('@creatorconnect/utils')).generateUuidV7(),
        userId: adminUserId,
        action: 'ADMIN_USER_REACTIVATED',
        entity: 'User',
        entityId: targetUserId,
        ipAddress: ipAddress ?? null,
        userAgent: userAgent ?? null,
        metadata: {
          targetUserId,
          reason,
          newStatus: 'ACTIVE',
        },
      },
    });

    return await this.getUserItem(targetUserId);
  }

  public async getUserActivity(userId: string, limit = 50): Promise<any[]> {
    const logs = await this.prisma.auditLog.findMany({
      where: {
        OR: [{ entityId: userId }, { userId }],
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 100),
    });

    return logs.map((l) => ({
      id: l.id,
      userId: l.userId,
      action: l.action,
      entity: l.entity,
      entityId: l.entityId,
      ipAddress: l.ipAddress,
      userAgent: l.userAgent,
      metadata: sanitizeAuditMetadata(l.metadata),
      createdAt: l.createdAt.toISOString(),
    }));
  }

  private async getUserItem(userId: string): Promise<AdminUserListItem> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        userRoles: { include: { role: true } },
        adminUserRoles: { include: { role: true } },
        creatorProfile: { select: { isVerified: true, bio: true } },
        professionalProfile: { select: { bio: true } },
        brandProfile: { select: { isVerified: true, bio: true } },
        podcasterProfile: { select: { description: true } },
        _count: {
          select: { clientProjects: true, talentProjects: true },
        },
      },
    });
    return this.mapToAdminUserListItem(user);
  }
}

export const adminUsersService = new AdminUsersService();
