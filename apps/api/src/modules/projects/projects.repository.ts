import { getPrismaClient, Prisma } from '@creatorconnect/database';
import type { ProjectStatus } from '@creatorconnect/contracts';

export class ProjectsRepository {
  constructor(private prisma = getPrismaClient()) {}

  async findById(id: string) {
    return this.prisma.project.findUnique({
      where: { id },
      include: {
        client: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        talent: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        assignment: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
        deliverables: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  async findByApplicationId(applicationId: string) {
    return this.prisma.project.findUnique({
      where: { applicationId },
    });
  }

  async findByUserId(
    userId: string,
    filters?: {
      role?: 'client' | 'talent' | undefined;
      status?: ProjectStatus | undefined;
    },
  ) {
    const where: Prisma.ProjectWhereInput = {};

    if (filters?.role === 'client') {
      where.clientId = userId;
    } else if (filters?.role === 'talent') {
      where.talentId = userId;
    } else {
      where.OR = [{ clientId: userId }, { talentId: userId }];
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    return this.prisma.project.findMany({
      where,
      include: {
        client: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        talent: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        deliverables: {
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findDeliverableById(deliverableId: string) {
    return this.prisma.projectDeliverable.findUnique({
      where: { id: deliverableId },
      include: {
        project: true,
      },
    });
  }
}

export const projectsRepository = new ProjectsRepository();
