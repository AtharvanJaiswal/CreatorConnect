import { getPrismaClient } from '@creatorconnect/database';

export interface LockedAssignment {
  id: string;
  brand_id: string;
  status: string;
  is_active: boolean;
  is_past_deadline: boolean;
}

export class ApplicationsRepository {
  constructor(private prisma = getPrismaClient()) {}

  async findById(id: string) {
    return this.prisma.application.findUnique({
      where: { id },
      include: {
        assignment: {
          include: { brand: true },
        },
        applicant: true,
        history: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  async findByAssignmentId(assignmentId: string) {
    return this.prisma.application.findMany({
      where: { assignmentId },
      include: {
        applicant: true,
        history: {
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByApplicantId(applicantId: string) {
    return this.prisma.application.findMany({
      where: { applicantId },
      include: {
        assignment: {
          include: { brand: true },
        },
        history: {
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async lockAssignmentForApply(tx: any, assignmentId: string): Promise<LockedAssignment | null> {
    const rows = await tx.$queryRaw<LockedAssignment[]>`
      SELECT 
        id, 
        brand_id, 
        status,
        (status = 'PUBLISHED' AND deleted_at IS NULL) AS is_active,
        (deadline <= NOW()) AS is_past_deadline
      FROM assignments
      WHERE id = ${assignmentId}::uuid
      FOR UPDATE;
    `;
    return rows[0] || null;
  }
}

export const applicationsRepository = new ApplicationsRepository();
