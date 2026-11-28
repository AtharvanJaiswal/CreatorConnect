import { type PrismaClient, getPrismaClient, UserStatus, RoleType } from '@creatorconnect/database';
import { generateUuidV7 } from '@creatorconnect/utils';
import type {
  CampaignListQuery,
  CampaignListResponse,
  NotificationCampaignResponse,
  CreateNotificationCampaignRequest,
} from '@creatorconnect/contracts';
import { NotFoundError, BadRequestError } from '../../../errors/app-error.js';

export class AdminNotificationsService {
  private prisma: PrismaClient;

  constructor(prismaClient?: PrismaClient) {
    this.prisma = prismaClient || getPrismaClient();
  }

  public async listCampaigns(query: CampaignListQuery): Promise<CampaignListResponse> {
    const page = Math.max(query.page || 1, 1);
    const limit = Math.min(Math.max(query.limit || 20, 1), 100);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.status) {
      where.status = query.status;
    }

    const [total, campaigns] = await Promise.all([
      this.prisma.notificationCampaign.count({ where }),
      this.prisma.notificationCampaign.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const items: NotificationCampaignResponse[] = campaigns.map((c) => ({
      id: c.id,
      title: c.title,
      message: c.message,
      targetType: c.targetType,
      channels: c.channels,
      status: c.status,
      scheduledAt: c.scheduledAt ? c.scheduledAt.toISOString() : null,
      estimatedRecipients: c.estimatedRecipients,
      sentCount: c.sentCount,
      failedCount: c.failedCount,
      createdById: c.createdById,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }));

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  public async estimateRecipients(targetType: string): Promise<number> {
    switch (targetType) {
      case 'CREATORS':
      case 'CREATORS_ONLY':
        return await this.prisma.user.count({
          where: {
            status: UserStatus.ACTIVE,
            userRoles: { some: { role: { name: RoleType.CREATOR } } },
          },
        });
      case 'BRANDS':
      case 'BRANDS_ONLY':
        return await this.prisma.user.count({
          where: {
            status: UserStatus.ACTIVE,
            userRoles: { some: { role: { name: RoleType.BRAND } } },
          },
        });
      case 'ALL_USERS':
      case 'ACTIVE_USERS':
      default:
        return await this.prisma.user.count({
          where: { status: UserStatus.ACTIVE },
        });
    }
  }

  public async createCampaign(
    input: CreateNotificationCampaignRequest,
    adminUserId: string,
  ): Promise<NotificationCampaignResponse> {
    const estimated = await this.estimateRecipients(input.targetType);

    const isScheduled = input.scheduledAt && new Date(input.scheduledAt) > new Date();
    const initialStatus = isScheduled ? 'SCHEDULED' : 'DRAFT';

    const campaign = await this.prisma.notificationCampaign.create({
      data: {
        id: generateUuidV7(),
        title: input.title,
        message: input.message,
        targetType: input.targetType,
        channels: input.channels,
        status: initialStatus,
        scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
        estimatedRecipients: estimated,
        createdById: adminUserId,
        idempotencyKey: input.idempotencyKey || null,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        id: generateUuidV7(),
        userId: adminUserId,
        action: 'NOTIFICATION_CAMPAIGN_CREATED',
        entity: 'NotificationCampaign',
        entityId: campaign.id,
        metadata: {
          title: campaign.title,
          targetType: campaign.targetType,
          status: campaign.status,
          estimatedRecipients: estimated,
        },
      },
    });

    return {
      id: campaign.id,
      title: campaign.title,
      message: campaign.message,
      targetType: campaign.targetType,
      channels: campaign.channels,
      status: campaign.status,
      scheduledAt: campaign.scheduledAt ? campaign.scheduledAt.toISOString() : null,
      estimatedRecipients: campaign.estimatedRecipients,
      sentCount: campaign.sentCount,
      failedCount: campaign.failedCount,
      createdById: campaign.createdById,
      createdAt: campaign.createdAt.toISOString(),
      updatedAt: campaign.updatedAt.toISOString(),
    };
  }

  public async sendCampaign(
    campaignId: string,
    adminUserId: string,
  ): Promise<NotificationCampaignResponse> {
    const campaign = await this.prisma.notificationCampaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      throw new NotFoundError(`Notification campaign not found: ${campaignId}`);
    }

    if (campaign.status === 'SENT') {
      throw new BadRequestError('Campaign has already been executed and sent.');
    }

    const updated = await this.prisma.notificationCampaign.update({
      where: { id: campaignId },
      data: {
        status: 'SENT',
        sentCount: campaign.estimatedRecipients,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        id: generateUuidV7(),
        userId: adminUserId,
        action: 'NOTIFICATION_CAMPAIGN_SENT',
        entity: 'NotificationCampaign',
        entityId: campaignId,
        metadata: {
          sentCount: updated.sentCount,
          targetType: updated.targetType,
        },
      },
    });

    return {
      id: updated.id,
      title: updated.title,
      message: updated.message,
      targetType: updated.targetType,
      channels: updated.channels,
      status: updated.status,
      scheduledAt: updated.scheduledAt ? updated.scheduledAt.toISOString() : null,
      estimatedRecipients: updated.estimatedRecipients,
      sentCount: updated.sentCount,
      failedCount: updated.failedCount,
      createdById: updated.createdById,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  public async cancelCampaign(
    campaignId: string,
    adminUserId: string,
  ): Promise<NotificationCampaignResponse> {
    const campaign = await this.prisma.notificationCampaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      throw new NotFoundError(`Notification campaign not found: ${campaignId}`);
    }

    if (campaign.status === 'SENT') {
      throw new BadRequestError('Cannot cancel a campaign that has already been sent.');
    }

    const updated = await this.prisma.notificationCampaign.update({
      where: { id: campaignId },
      data: { status: 'CANCELLED' },
    });

    await this.prisma.auditLog.create({
      data: {
        id: generateUuidV7(),
        userId: adminUserId,
        action: 'NOTIFICATION_CAMPAIGN_CANCELLED',
        entity: 'NotificationCampaign',
        entityId: campaignId,
      },
    });

    return {
      id: updated.id,
      title: updated.title,
      message: updated.message,
      targetType: updated.targetType,
      channels: updated.channels,
      status: updated.status,
      scheduledAt: updated.scheduledAt ? updated.scheduledAt.toISOString() : null,
      estimatedRecipients: updated.estimatedRecipients,
      sentCount: updated.sentCount,
      failedCount: updated.failedCount,
      createdById: updated.createdById,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }
}

export const adminNotificationsService = new AdminNotificationsService();
