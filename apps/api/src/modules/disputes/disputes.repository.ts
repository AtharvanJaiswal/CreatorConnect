import { getPrismaClient, Prisma } from '@creatorconnect/database';
import type { DisputeStatus } from '@creatorconnect/contracts';

export class DisputesRepository {
  constructor(private prisma = getPrismaClient()) {}

  async findById(id: string) {
    return this.prisma.dispute.findUnique({
      where: { id },
      include: {
        project: {
          select: {
            id: true,
            title: true,
            clientId: true,
            talentId: true,
            status: true,
            totalAmount: true,
            currency: true,
          },
        },
        deliverable: {
          select: {
            id: true,
            title: true,
            status: true,
            amount: true,
          },
        },
        openedBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        resolvedBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        evidence: {
          include: {
            mediaAsset: true,
            uploadedBy: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        history: {
          include: {
            actor: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  async findActiveDisputeByProjectId(projectId: string) {
    return this.prisma.dispute.findFirst({
      where: {
        projectId,
        status: {
          notIn: ['RESOLVED_FOR_CLIENT', 'RESOLVED_FOR_CREATOR', 'CLOSED'],
        },
      },
    });
  }

  async listDisputes(filters?: {
    userId?: string | undefined;
    projectId?: string | undefined;
    status?: DisputeStatus | undefined;
    isAdmin?: boolean | undefined;
  }) {
    const where: Prisma.DisputeWhereInput = {};

    if (filters?.projectId) {
      where.projectId = filters.projectId;
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    if (!filters?.isAdmin && filters?.userId) {
      where.project = {
        OR: [{ clientId: filters.userId }, { talentId: filters.userId }],
      };
    }

    return this.prisma.dispute.findMany({
      where,
      include: {
        project: {
          select: {
            id: true,
            title: true,
            clientId: true,
            talentId: true,
            status: true,
          },
        },
        deliverable: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
        evidence: true,
        history: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findEvidenceById(evidenceId: string) {
    return this.prisma.disputeEvidence.findUnique({
      where: { id: evidenceId },
      include: {
        dispute: {
          include: { project: true },
        },
      },
    });
  }
}

export const disputesRepository = new DisputesRepository();
