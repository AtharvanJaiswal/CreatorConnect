import { getPrismaClient, type AssignmentStatus, type Prisma } from '@creatorconnect/database';

export class AssignmentsRepository {
  constructor(private prisma = getPrismaClient()) {}

  async create(
    data: Prisma.AssignmentUncheckedCreateInput,
    requirements?: Array<{ title: string; isMandatory?: boolean }>,
  ) {
    const createData: any = { ...data };
    if (requirements && requirements.length > 0) {
      createData.requirements = {
        create: requirements.map((r) => ({
          id: (r as any).id,
          title: r.title,
          isMandatory: r.isMandatory ?? true,
        })),
      };
    }

    return this.prisma.assignment.create({
      data: createData,
      include: {
        requirements: true,
        brand: true,
      },
    });
  }

  async findById(id: string) {
    return this.prisma.assignment.findUnique({
      where: { id },
      include: {
        requirements: true,
        brand: true,
      },
    });
  }

  async findByBrandId(brandId: string) {
    return this.prisma.assignment.findMany({
      where: { brandId, deletedAt: null },
      include: {
        requirements: true,
        brand: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateOptimistic(
    id: string,
    expectedVersion: number,
    data: Prisma.AssignmentUncheckedUpdateInput,
  ): Promise<number> {
    const res = await this.prisma.assignment.updateMany({
      where: { id, version: expectedVersion },
      data: {
        ...data,
        version: { increment: 1 },
      },
    });
    return res.count;
  }

  async updateStatusOptimistic(
    id: string,
    expectedVersion: number,
    status: AssignmentStatus,
  ): Promise<number> {
    const res = await this.prisma.assignment.updateMany({
      where: { id, version: expectedVersion },
      data: {
        status,
        version: { increment: 1 },
      },
    });
    return res.count;
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.assignment.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}

export const assignmentsRepository = new AssignmentsRepository();
