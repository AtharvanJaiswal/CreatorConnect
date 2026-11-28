import {
  type PrismaClient,
  getPrismaClient,
  PaymentStatus,
  ProjectStatus,
  UserStatus,
} from '@creatorconnect/database';
import { redisCache, type RedisCacheService } from '../../../services/redis-cache.js';
import type { DashboardOverviewResponse, DashboardDateRangeQuery } from '@creatorconnect/contracts';

export class AdminDashboardService {
  private prisma: PrismaClient;
  private cache: RedisCacheService;

  constructor(prismaClient?: PrismaClient, cacheSvc?: RedisCacheService) {
    this.prisma = prismaClient || getPrismaClient();
    this.cache = cacheSvc || redisCache;
  }

  private resolveDateRange(query: DashboardDateRangeQuery): {
    startDate: Date;
    endDate: Date;
    prevStartDate: Date;
    prevEndDate: Date;
    periodName: string;
  } {
    const now = new Date();
    const period = query.period || '7d';

    let startDate: Date;
    let endDate = now;
    let prevStartDate: Date;
    let prevEndDate: Date;

    if (period === 'today') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const dayMs = 24 * 60 * 60 * 1000;
      prevStartDate = new Date(startDate.getTime() - dayMs);
      prevEndDate = new Date(startDate.getTime());
    } else if (period === 'yesterday') {
      const dayMs = 24 * 60 * 60 * 1000;
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      startDate = new Date(endDate.getTime() - dayMs);
      prevStartDate = new Date(startDate.getTime() - dayMs);
      prevEndDate = new Date(startDate.getTime());
    } else if (period === '30d') {
      const ms = 30 * 24 * 60 * 60 * 1000;
      startDate = new Date(now.getTime() - ms);
      prevStartDate = new Date(startDate.getTime() - ms);
      prevEndDate = new Date(startDate.getTime());
    } else if (period === '90d') {
      const ms = 90 * 24 * 60 * 60 * 1000;
      startDate = new Date(now.getTime() - ms);
      prevStartDate = new Date(startDate.getTime() - ms);
      prevEndDate = new Date(startDate.getTime());
    } else if (period === 'custom' && query.startDate && query.endDate) {
      startDate = new Date(query.startDate);
      endDate = new Date(query.endDate);
      const spanMs = endDate.getTime() - startDate.getTime();
      prevStartDate = new Date(startDate.getTime() - spanMs);
      prevEndDate = new Date(startDate.getTime());
    } else {
      // Default: 7d
      const ms = 7 * 24 * 60 * 60 * 1000;
      startDate = new Date(now.getTime() - ms);
      prevStartDate = new Date(startDate.getTime() - ms);
      prevEndDate = new Date(startDate.getTime());
    }

    return {
      startDate,
      endDate,
      prevStartDate,
      prevEndDate,
      periodName: period,
    };
  }

  public async getOverview(query: DashboardDateRangeQuery): Promise<DashboardOverviewResponse> {
    const { startDate, endDate, prevStartDate, prevEndDate, periodName } =
      this.resolveDateRange(query);

    const cacheKey = `admin:dashboard:overview:${periodName}:${startDate.toISOString()}:${endDate.toISOString()}`;

    // Attempt cache read
    const redisClient = this.cache.getClient();
    if (redisClient && this.cache.isRedisConnected()) {
      try {
        const cached = await redisClient.get(cacheKey);
        if (cached) {
          return JSON.parse(cached) as DashboardOverviewResponse;
        }
      } catch {
        // Fall back to live database aggregation
      }
    }

    // Execute optimized parallel database aggregation
    const [
      totalUsers,
      activeUsers,
      suspendedAccounts,
      newRegistrations,
      previousRegistrations,
      activeCreators,
      activeClients,
      projectsCreated,
      projectsInProgress,
      projectsCompleted,
      projectsDisputed,
      totalTransactions,
      successfulPayments,
      failedPayments,
      volumeAndRevenue,
      pendingRefundsCount,
      pendingRefundsVolume,
      openSupportTickets,
      pendingModerationReports,
      avgSupportResolutionTime,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { status: UserStatus.ACTIVE } }),
      this.prisma.user.count({ where: { status: UserStatus.SUSPENDED } }),
      this.prisma.user.count({
        where: { createdAt: { gte: startDate, lte: endDate } },
      }),
      this.prisma.user.count({
        where: { createdAt: { gte: prevStartDate, lte: prevEndDate } },
      }),
      this.prisma.creatorProfile.count(),
      this.prisma.brandProfile.count(),
      this.prisma.project.count({
        where: { createdAt: { gte: startDate, lte: endDate } },
      }),
      this.prisma.project.count({ where: { status: ProjectStatus.IN_PROGRESS } }),
      this.prisma.project.count({ where: { status: ProjectStatus.COMPLETED } }),
      this.prisma.project.count({ where: { status: ProjectStatus.DISPUTED } }),
      this.prisma.paymentIntent.count({
        where: { createdAt: { gte: startDate, lte: endDate } },
      }),
      this.prisma.paymentIntent.count({
        where: {
          status: PaymentStatus.SUCCEEDED,
          createdAt: { gte: startDate, lte: endDate },
        },
      }),
      this.prisma.paymentIntent.count({
        where: {
          status: PaymentStatus.FAILED,
          createdAt: { gte: startDate, lte: endDate },
        },
      }),
      this.prisma.paymentIntent.aggregate({
        where: {
          status: PaymentStatus.SUCCEEDED,
          createdAt: { gte: startDate, lte: endDate },
        },
        _sum: {
          amount: true,
          platformFee: true,
        },
      }),
      this.prisma.refund.count({ where: { status: 'PENDING' } }),
      this.prisma.refund.aggregate({
        where: { status: 'PENDING' },
        _sum: { amount: true },
      }),
      this.prisma.supportTicket.count({
        where: {
          status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING_FOR_CUSTOMER'] },
        },
      }),
      this.prisma.report.count({
        where: { status: { in: ['PENDING', 'INVESTIGATING'] } },
      }),
      this.prisma.supportTicket.findMany({
        where: { resolvedAt: { not: null } },
        select: { createdAt: true, resolvedAt: true },
        take: 100,
        orderBy: { resolvedAt: 'desc' },
      }),
    ]);

    // Precise Metric Formulas
    // 1. Registration growth = ((current - prev) / max(prev, 1)) * 100
    let registrationGrowthPercent = 0;
    if (previousRegistrations === 0) {
      registrationGrowthPercent = newRegistrations > 0 ? 100 : 0;
    } else {
      registrationGrowthPercent = Number(
        (((newRegistrations - previousRegistrations) / previousRegistrations) * 100).toFixed(2),
      );
    }

    // 2. Payment success rate = (successful / max(successful + failed, 1)) * 100
    const totalFinishedPayments = successfulPayments + failedPayments;
    const paymentSuccessRate =
      totalFinishedPayments > 0
        ? Number(((successfulPayments / totalFinishedPayments) * 100).toFixed(2))
        : 100;

    // 3. Project completion rate = (completed / max(completed + disputed, 1)) * 100
    const eligibleProjects = projectsCompleted + projectsDisputed;
    const projectCompletionRate =
      eligibleProjects > 0
        ? Number(((projectsCompleted / eligibleProjects) * 100).toFixed(2))
        : 100;

    // 4. Average support response minutes
    let averageSupportResponseMinutes = 0;
    if (avgSupportResolutionTime.length > 0) {
      const totalMinutes = avgSupportResolutionTime.reduce((acc, t) => {
        if (!t.resolvedAt) return acc;
        return acc + (t.resolvedAt.getTime() - t.createdAt.getTime()) / (60 * 1000);
      }, 0);
      averageSupportResponseMinutes = Number(
        (totalMinutes / avgSupportResolutionTime.length).toFixed(1),
      );
    }

    const response: DashboardOverviewResponse = {
      period: periodName,
      metrics: {
        totalUsers,
        activeUsers,
        newRegistrations,
        registrationGrowthPercent,
        suspendedAccounts,
        activeCreators,
        activeClients,
        projectsCreated,
        projectsInProgress,
        projectsCompleted,
        projectsDisputed,
        projectCompletionRate,
        totalTransactions,
        successfulPayments,
        failedPayments,
        paymentSuccessRate,
        totalTransactionVolumeMinor: (volumeAndRevenue._sum.amount || 0).toString(),
        platformRevenueMinor: (volumeAndRevenue._sum.platformFee || 0).toString(),
        pendingRefundsCount,
        pendingRefundsVolumeMinor: (pendingRefundsVolume._sum.amount || 0).toString(),
        openSupportTickets,
        pendingModerationReports,
        averageSupportResponseMinutes,
      },
      timestamp: new Date().toISOString(),
    };

    // Cache for 60 seconds
    if (redisClient && this.cache.isRedisConnected()) {
      try {
        await redisClient.setex(cacheKey, 60, JSON.stringify(response));
      } catch {
        // Cache failures are non-blocking
      }
    }

    return response;
  }
}

export const adminDashboardService = new AdminDashboardService();
