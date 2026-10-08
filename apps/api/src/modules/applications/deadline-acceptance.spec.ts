import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getPrismaClient } from '@creatorconnect/database';
import { generateUuidV7 } from '@creatorconnect/utils';
import { ApplicationsService } from './applications.service.js';
import { AssignmentDeadlineExpiredError } from '../../errors/app-error.js';

describe('Assignment Acceptance Deadline PostgreSQL Enforcement (F-08)', () => {
  const prisma = getPrismaClient();
  const service = new ApplicationsService();

  let brandUserId: string;
  let brandProfileId: string;
  let applicantUserId: string;
  const createdAssignmentIds: string[] = [];
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    brandUserId = generateUuidV7();
    brandProfileId = generateUuidV7();
    applicantUserId = generateUuidV7();

    createdUserIds.push(brandUserId, applicantUserId);

    // Create Brand User & Profile
    await prisma.user.create({
      data: {
        id: brandUserId,
        supabaseAuthId: `sub_brand_${brandUserId}`,
        email: `brand_${brandUserId}@test.com`,
        status: 'ACTIVE',
        userRoles: {
          create: {
            id: generateUuidV7(),
            role: {
              connectOrCreate: {
                where: { name: 'BRAND' },
                create: { id: generateUuidV7(), name: 'BRAND' },
              },
            },
          },
        },
        brandProfile: {
          create: {
            id: brandProfileId,
            companyName: 'Deadline Testing Inc',
          },
        },
      },
    });

    // Create Applicant User
    await prisma.user.create({
      data: {
        id: applicantUserId,
        supabaseAuthId: `sub_applicant_${applicantUserId}`,
        email: `applicant_${applicantUserId}@test.com`,
        status: 'ACTIVE',
        userRoles: {
          create: {
            id: generateUuidV7(),
            role: {
              connectOrCreate: {
                where: { name: 'CREATOR' },
                create: { id: generateUuidV7(), name: 'CREATOR' },
              },
            },
          },
        },
      },
    });
  });

  afterAll(async () => {
    for (const assignmentId of createdAssignmentIds) {
      await prisma.applicationStatusHistory.deleteMany({
        where: { application: { assignmentId } },
      });
      await prisma.application.deleteMany({ where: { assignmentId } });
      await prisma.assignment.deleteMany({ where: { id: assignmentId } });
    }
    await prisma.brandProfile.deleteMany({ where: { id: brandProfileId } });
    for (const userId of createdUserIds) {
      await prisma.userRole.deleteMany({ where: { userId } });
      await prisma.user.deleteMany({ where: { id: userId } });
    }
  });

  it('rejects candidate acceptance when deadline has passed in PostgreSQL even if assignment is still PUBLISHED and worker has not run', async () => {
    const assignmentId = generateUuidV7();
    createdAssignmentIds.push(assignmentId);

    // Set deadline 10 minutes in the PAST
    const pastDeadline = new Date(Date.now() - 10 * 60 * 1000);

    await prisma.assignment.create({
      data: {
        id: assignmentId,
        brandId: brandProfileId,
        title: 'Past Deadline Assignment',
        description: 'Testing acceptance past deadline.',
        budgetType: 'FIXED',
        budgetMin: 5000,
        budgetMax: 5000,
        currency: 'INR',
        deadline: pastDeadline,
        status: 'PUBLISHED',
        version: 1,
      },
    });

    const applicationId = generateUuidV7();
    await prisma.application.create({
      data: {
        id: applicationId,
        assignmentId,
        applicantId: applicantUserId,
        coverLetter: 'I can do this.',
        proposedRate: 5000,
        currency: 'INR',
        status: 'SHORTLISTED',
        version: 1,
      },
    });

    // Attempt acceptance directly against service (no worker run)
    await expect(
      service.acceptApplication(brandUserId, false, assignmentId, applicationId, {
        expectedVersion: 1,
        expectedApplicationVersion: 1,
      }),
    ).rejects.toThrow(AssignmentDeadlineExpiredError);

    // Verify database state: assignment remains PUBLISHED, application remains SHORTLISTED
    const assignmentInDb = await prisma.assignment.findUnique({ where: { id: assignmentId } });
    expect(assignmentInDb?.status).toBe('PUBLISHED');

    const appInDb = await prisma.application.findUnique({ where: { id: applicationId } });
    expect(appInDb?.status).toBe('SHORTLISTED');
  });

  it('permits candidate acceptance when deadline is in the future (boundary test)', async () => {
    const assignmentId = generateUuidV7();
    createdAssignmentIds.push(assignmentId);

    // Set deadline 2 hours in the FUTURE
    const futureDeadline = new Date(Date.now() + 2 * 60 * 60 * 1000);

    await prisma.assignment.create({
      data: {
        id: assignmentId,
        brandId: brandProfileId,
        title: 'Active Future Deadline Assignment',
        description: 'Testing valid acceptance before deadline.',
        budgetType: 'FIXED',
        budgetMin: 10000,
        budgetMax: 10000,
        currency: 'INR',
        deadline: futureDeadline,
        status: 'PUBLISHED',
        version: 1,
      },
    });

    const applicationId = generateUuidV7();
    await prisma.application.create({
      data: {
        id: applicationId,
        assignmentId,
        applicantId: applicantUserId,
        coverLetter: 'Ready to work.',
        proposedRate: 10000,
        currency: 'INR',
        status: 'SHORTLISTED',
        version: 1,
      },
    });

    const result = await service.acceptApplication(
      brandUserId,
      false,
      assignmentId,
      applicationId,
      {
        expectedVersion: 1,
        expectedApplicationVersion: 1,
      },
    );

    expect(result.status).toBe('ACCEPTED');

    const assignmentInDb = await prisma.assignment.findUnique({ where: { id: assignmentId } });
    expect(assignmentInDb?.status).toBe('IN_PROGRESS');
  });
});
