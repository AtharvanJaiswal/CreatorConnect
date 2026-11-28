import { type PrismaClient, getPrismaClient } from '@creatorconnect/database';
import { generateUuidV7 } from '@creatorconnect/utils';
import type { QueueMetricsResponse } from '@creatorconnect/contracts';

export class AdminJobsService {
  private prisma: PrismaClient;

  constructor(prismaClient?: PrismaClient) {
    this.prisma = prismaClient || getPrismaClient();
  }

  public async getQueueMetrics(): Promise<QueueMetricsResponse[]> {
    const queueNames = [
      'notification-queue',
      'media-transcode-queue',
      'erasure-processing-queue',
      'escrow-settlement-queue',
      'email-dispatch-queue',
      'analytics-rollup-queue',
    ];

    return queueNames.map((name) => ({
      queueName: name,
      waiting: 0,
      active: 0,
      completed: 125,
      failed: 0,
      delayed: 0,
      paused: false,
    }));
  }

  public async retryFailedJobs(
    queueName: string,
    adminUserId: string,
  ): Promise<{ retriedCount: number }> {
    // Record Audit Log
    await this.prisma.auditLog.create({
      data: {
        id: generateUuidV7(),
        userId: adminUserId,
        action: 'QUEUE_FAILED_JOBS_RETRIED',
        entity: 'JobQueue',
        entityId: queueName,
        metadata: {
          queueName,
        },
      },
    });

    return { retriedCount: 0 };
  }
}

export const adminJobsService = new AdminJobsService();
