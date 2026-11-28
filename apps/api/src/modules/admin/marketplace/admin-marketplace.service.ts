import { type PrismaClient, getPrismaClient, ProjectStatus } from '@creatorconnect/database';
import { generateUuidV7 } from '@creatorconnect/utils';
import type {
  AdminCreatorQuery,
  AdminCreatorListResponse,
  AdminCreatorListItem,
  AdminClientQuery,
  AdminClientListResponse,
  AdminClientListItem,
  AdminProjectQuery,
  AdminProjectListResponse,
  AdminProjectListItem,
  ModerateProjectRequest,
} from '@creatorconnect/contracts';
import { NotFoundError } from '../../../errors/app-error.js';

export class AdminMarketplaceService {
  private prisma: PrismaClient;

  constructor(prismaClient?: PrismaClient) {
    this.prisma = prismaClient || getPrismaClient();
  }

  // ==============================================================================
  // Creator Operations
  // ==============================================================================

  public async listCreators(query: AdminCreatorQuery): Promise<AdminCreatorListResponse> {
    const page = Math.max(query.page || 1, 1);
    const limit = Math.min(Math.max(query.limit || 20, 1), 100);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.isVerified !== undefined) {
      where.isVerified = query.isVerified;
    }
    if (query.visibility) {
      where.visibility = query.visibility;
    }
    if (query.search && query.search.trim()) {
      const term = query.search.trim();
      where.OR = [
        { user: { email: { contains: term, mode: 'insensitive' } } },
        { user: { firstName: { contains: term, mode: 'insensitive' } } },
        { user: { lastName: { contains: term, mode: 'insensitive' } } },
        { bio: { contains: term, mode: 'insensitive' } },
      ];
    }

    const [total, creators] = await Promise.all([
      this.prisma.creatorProfile.count({ where }),
      this.prisma.creatorProfile.findMany({
        where,
        include: {
          user: {
            include: {
              reviewsReceived: { select: { rating: true } },
              _count: {
                select: {
                  talentProjects: { where: { status: ProjectStatus.COMPLETED } },
                  portfolioItems: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const items: AdminCreatorListItem[] = creators.map((c) => {
      const reviews = c.user.reviewsReceived || [];
      const avgRating =
        reviews.length > 0
          ? Number((reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(2))
          : 0;

      return {
        id: c.id,
        userId: c.userId,
        email: c.user.email,
        firstName: c.user.firstName,
        lastName: c.user.lastName,
        bio: c.bio,
        isVerified: c.isVerified,
        visibility: c.visibility,
        portfolioCount: c.user._count.portfolioItems,
        completedProjects: c.user._count.talentProjects,
        averageRating: avgRating,
        createdAt: c.createdAt.toISOString(),
      };
    });

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  public async verifyCreator(
    creatorProfileId: string,
    isVerified: boolean,
    reason: string,
    adminUserId: string,
  ): Promise<AdminCreatorListItem> {
    const creator = await this.prisma.creatorProfile.findUnique({
      where: { id: creatorProfileId },
      include: {
        user: {
          include: {
            reviewsReceived: { select: { rating: true } },
            _count: {
              select: {
                talentProjects: { where: { status: ProjectStatus.COMPLETED } },
                portfolioItems: true,
              },
            },
          },
        },
      },
    });

    if (!creator) {
      throw new NotFoundError(`Creator profile not found: ${creatorProfileId}`);
    }

    const updated = await this.prisma.creatorProfile.update({
      where: { id: creatorProfileId },
      data: { isVerified },
      include: {
        user: {
          include: {
            reviewsReceived: { select: { rating: true } },
            _count: {
              select: {
                talentProjects: { where: { status: ProjectStatus.COMPLETED } },
                portfolioItems: true,
              },
            },
          },
        },
      },
    });

    // Record Audit Log
    await this.prisma.auditLog.create({
      data: {
        id: generateUuidV7(),
        userId: adminUserId,
        action: isVerified ? 'CREATOR_VERIFIED' : 'CREATOR_UNVERIFIED',
        entity: 'CreatorProfile',
        entityId: creatorProfileId,
        metadata: {
          userId: creator.userId,
          isVerified,
          reason,
        },
      },
    });

    const reviews = updated.user.reviewsReceived || [];
    const avgRating =
      reviews.length > 0
        ? Number((reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(2))
        : 0;

    return {
      id: updated.id,
      userId: updated.userId,
      email: updated.user.email,
      firstName: updated.user.firstName,
      lastName: updated.user.lastName,
      bio: updated.bio,
      isVerified: updated.isVerified,
      visibility: updated.visibility,
      portfolioCount: updated.user._count.portfolioItems,
      completedProjects: updated.user._count.talentProjects,
      averageRating: avgRating,
      createdAt: updated.createdAt.toISOString(),
    };
  }

  // ==============================================================================
  // Client Operations
  // ==============================================================================

  public async listClients(query: AdminClientQuery): Promise<AdminClientListResponse> {
    const page = Math.max(query.page || 1, 1);
    const limit = Math.min(Math.max(query.limit || 20, 1), 100);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.isVerified !== undefined) {
      where.isVerified = query.isVerified;
    }
    if (query.search && query.search.trim()) {
      const term = query.search.trim();
      where.OR = [
        { companyName: { contains: term, mode: 'insensitive' } },
        { industry: { contains: term, mode: 'insensitive' } },
        { user: { email: { contains: term, mode: 'insensitive' } } },
      ];
    }

    const [total, clients] = await Promise.all([
      this.prisma.brandProfile.count({ where }),
      this.prisma.brandProfile.findMany({
        where,
        include: {
          user: {
            include: {
              _count: {
                select: { clientProjects: true },
              },
              clientPaymentIntents: {
                where: { status: 'SUCCEEDED' },
                select: { amount: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const items: AdminClientListItem[] = clients.map((b) => {
      const totalSpend = b.user.clientPaymentIntents.reduce((acc, p) => acc + p.amount, 0);

      return {
        id: b.id,
        userId: b.userId,
        email: b.user.email,
        companyName: b.companyName,
        industry: b.industry,
        isVerified: b.isVerified,
        totalProjects: b.user._count.clientProjects,
        totalSpentMinor: totalSpend.toString(),
        createdAt: b.createdAt.toISOString(),
      };
    });

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  public async verifyClient(
    brandProfileId: string,
    isVerified: boolean,
    reason: string,
    adminUserId: string,
  ): Promise<AdminClientListItem> {
    const client = await this.prisma.brandProfile.findUnique({
      where: { id: brandProfileId },
      include: {
        user: {
          include: {
            _count: { select: { clientProjects: true } },
            clientPaymentIntents: { where: { status: 'SUCCEEDED' }, select: { amount: true } },
          },
        },
      },
    });

    if (!client) {
      throw new NotFoundError(`Client profile not found: ${brandProfileId}`);
    }

    const updated = await this.prisma.brandProfile.update({
      where: { id: brandProfileId },
      data: { isVerified },
      include: {
        user: {
          include: {
            _count: { select: { clientProjects: true } },
            clientPaymentIntents: { where: { status: 'SUCCEEDED' }, select: { amount: true } },
          },
        },
      },
    });

    // Record Audit Log
    await this.prisma.auditLog.create({
      data: {
        id: generateUuidV7(),
        userId: adminUserId,
        action: isVerified ? 'CLIENT_VERIFIED' : 'CLIENT_UNVERIFIED',
        entity: 'BrandProfile',
        entityId: brandProfileId,
        metadata: {
          userId: client.userId,
          isVerified,
          reason,
        },
      },
    });

    const totalSpend = updated.user.clientPaymentIntents.reduce((acc, p) => acc + p.amount, 0);

    return {
      id: updated.id,
      userId: updated.userId,
      email: updated.user.email,
      companyName: updated.companyName,
      industry: updated.industry,
      isVerified: updated.isVerified,
      totalProjects: updated.user._count.clientProjects,
      totalSpentMinor: totalSpend.toString(),
      createdAt: updated.createdAt.toISOString(),
    };
  }

  // ==============================================================================
  // Project Governance
  // ==============================================================================

  public async listProjects(query: AdminProjectQuery): Promise<AdminProjectListResponse> {
    const page = Math.max(query.page || 1, 1);
    const limit = Math.min(Math.max(query.limit || 20, 1), 100);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.status) {
      where.status = query.status;
    }
    if (query.clientId) {
      where.clientId = query.clientId;
    }
    if (query.talentId) {
      where.talentId = query.talentId;
    }
    if (query.hasDispute !== undefined) {
      where.disputes = query.hasDispute ? { some: {} } : { none: {} };
    }
    if (query.search && query.search.trim()) {
      const term = query.search.trim();
      where.title = { contains: term, mode: 'insensitive' };
    }

    const [total, projects] = await Promise.all([
      this.prisma.project.count({ where }),
      this.prisma.project.findMany({
        where,
        include: {
          client: { select: { email: true } },
          talent: { select: { email: true } },
          deliverables: { select: { id: true } },
          disputes: { select: { id: true, status: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const items: AdminProjectListItem[] = projects.map((p) => ({
      id: p.id,
      title: p.title,
      status: p.status,
      clientId: p.clientId,
      clientEmail: p.client.email,
      talentId: p.talentId,
      talentEmail: p.talent.email,
      totalAmountMinor: p.totalAmount.toString(),
      deliverablesCount: p.deliverables.length,
      hasDispute: p.disputes.length > 0,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    }));

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  public async getProjectDetails(projectId: string): Promise<any> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        client: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        talent: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        deliverables: {
          include: {
            submissions: {
              orderBy: { createdAt: 'desc' },
            },
          },
        },
        disputes: {
          include: {
            evidence: true,
            history: true,
          },
        },
        cancellations: true,
        paymentIntents: {
          include: {
            refunds: true,
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundError(`Project not found: ${projectId}`);
    }

    return {
      id: project.id,
      title: project.title,
      description: project.description,
      status: project.status,
      totalAmountMinor: project.totalAmount.toString(),
      currency: project.currency,
      client: project.client,
      talent: project.talent,
      deliverables: project.deliverables.map((d) => ({
        id: d.id,
        title: d.title,
        amountMinor: d.amount.toString(),
        status: d.status,
        submissionsCount: d.submissions.length,
        latestSubmission: d.submissions[0] || null,
      })),
      disputes: project.disputes,
      cancellations: project.cancellations,
      payments: project.paymentIntents.map((pi) => ({
        id: pi.id,
        amountMinor: pi.amount.toString(),
        status: pi.status,
        provider: pi.provider,
        providerOrderId: pi.providerOrderId,
        refundsCount: pi.refunds.length,
      })),
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    };
  }

  public async moderateProject(
    projectId: string,
    input: ModerateProjectRequest,
    adminUserId: string,
  ): Promise<any> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundError(`Project not found: ${projectId}`);
    }

    let newStatus: ProjectStatus = project.status as ProjectStatus;

    if (input.action === 'SUSPEND') {
      newStatus = ProjectStatus.CANCELLED;
    } else if (input.action === 'RESTORE') {
      newStatus = ProjectStatus.IN_PROGRESS;
    } else if (input.action === 'FLAG_UNDER_REVIEW') {
      newStatus = ProjectStatus.DISPUTED;
    }

    const updated = await this.prisma.project.update({
      where: { id: projectId },
      data: {
        status: newStatus,
      },
    });

    // Record Audit Log
    await this.prisma.auditLog.create({
      data: {
        id: generateUuidV7(),
        userId: adminUserId,
        action: 'PROJECT_MODERATED',
        entity: 'Project',
        entityId: projectId,
        metadata: {
          previousStatus: project.status,
          newStatus: updated.status,
          action: input.action,
          reason: input.reason,
        },
      },
    });

    return {
      id: updated.id,
      title: updated.title,
      status: updated.status,
      action: input.action,
      reason: input.reason,
      updatedAt: updated.updatedAt.toISOString(),
    };
  }
}

export const adminMarketplaceService = new AdminMarketplaceService();
