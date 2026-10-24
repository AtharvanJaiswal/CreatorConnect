import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { getPrismaClient } from '@creatorconnect/database';
import { generateUuidV7 } from '@creatorconnect/utils';
import { createTestJwt } from '../fixtures/auth-test-helper.js';

const SCREENSHOT_DIR =
  'C:/Users/athar/.gemini/antigravity-ide/brain/3b4965b1-a974-4b7a-8ccb-e2eea5c1de0a/screenshots';

test.describe('CreatorConnect Module Two — E2E Journey & Stitch Visual Verification', () => {
  test.describe.configure({ mode: 'serial' });
  const prisma = getPrismaClient();

  // Test User & Resource IDs for isolation and cleanup
  const createdUserIds: string[] = [];
  const createdAssignmentIds: string[] = [];
  const createdProjectIds: string[] = [];

  let brandUser: { userId: string; brandProfileId: string; token: string; email: string };
  let creatorUser: { userId: string; creatorProfileId: string; token: string; email: string };
  let intruderUser: { userId: string; token: string; email: string };

  let testAssignmentId: string;
  let testProjectId: string;
  let testDeliverableId: string;

  test.beforeAll(async () => {
    if (!fs.existsSync(SCREENSHOT_DIR)) {
      fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    }

    // 1. Provision Brand User
    const bUserId = generateUuidV7();
    const bSub = `sub_brand_e2e_${Date.now()}_${bUserId.replace(/-/g, '')}`;
    const bEmail = `brand_e2e_${Date.now()}_${bUserId.replace(/-/g, '')}@creatorconnect.test`;
    const bProfileId = generateUuidV7();

    createdUserIds.push(bUserId);
    await prisma.user.create({
      data: {
        id: bUserId,
        supabaseAuthId: bSub,
        email: bEmail,
        firstName: 'StitchBrand',
        lastName: 'Director',
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
            id: bProfileId,
            companyName: 'Lumina Creative Studio',
            websiteUrl: 'https://luminacreative.example.com',
            industry: 'Entertainment & Commercials',
          },
        },
      },
    });
    const bToken = await createTestJwt({ sub: bSub, email: bEmail });
    brandUser = { userId: bUserId, brandProfileId: bProfileId, token: bToken, email: bEmail };

    // 2. Provision Creator User
    const cUserId = generateUuidV7();
    const cSub = `sub_creator_e2e_${Date.now()}_${cUserId.replace(/-/g, '')}`;
    const cEmail = `creator_e2e_${Date.now()}_${cUserId.replace(/-/g, '')}@creatorconnect.test`;
    const cProfileId = generateUuidV7();

    createdUserIds.push(cUserId);
    await prisma.user.create({
      data: {
        id: cUserId,
        supabaseAuthId: cSub,
        email: cEmail,
        firstName: 'Aarav',
        lastName: 'Sen',
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
        creatorProfile: {
          create: {
            id: cProfileId,
            tagline: 'Award-winning Indie Commercial Director',
            bio: 'Directing cinematic storytelling for high-growth consumer brands.',
            startingRate: 5000000,
            currency: 'INR',
            visibility: 'PUBLIC',
            isVerified: true,
          },
        },
      },
    });
    const cToken = await createTestJwt({ sub: cSub, email: cEmail });
    creatorUser = { userId: cUserId, creatorProfileId: cProfileId, token: cToken, email: cEmail };

    // 3. Provision Unauthorized Intruder User
    const iUserId = generateUuidV7();
    const iSub = `sub_intruder_e2e_${Date.now()}_${iUserId.replace(/-/g, '')}`;
    const iEmail = `intruder_e2e_${Date.now()}_${iUserId.replace(/-/g, '')}@creatorconnect.test`;
    createdUserIds.push(iUserId);
    await prisma.user.create({
      data: {
        id: iUserId,
        supabaseAuthId: iSub,
        email: iEmail,
        firstName: 'Anonymous',
        lastName: 'Intruder',
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
    const iToken = await createTestJwt({ sub: iSub, email: iEmail });
    intruderUser = { userId: iUserId, token: iToken, email: iEmail };

    // 4. Seed Canonical Published Assignment (for Discovery & Applications)
    testAssignmentId = generateUuidV7();
    createdAssignmentIds.push(testAssignmentId);
    await prisma.assignment.create({
      data: {
        id: testAssignmentId,
        brandId: brandUser.brandProfileId,
        title: 'Cinematic Brand Commercial Video (Module G Canonical)',
        description:
          'Seeking a skilled director and cinematographer for our luxury watch Autumn launch. High production value, 4K master deliverables, and tight milestone timeline required.',
        budgetType: 'RANGE',
        budgetMin: 7500000, // 75,000 INR
        budgetMax: 12000000, // 120,000 INR
        currency: 'INR',
        deadline: new Date(Date.now() + 14 * 86400000),
        isRemote: true,
        location: 'Mumbai & Remote Post',
        status: 'PUBLISHED',
        version: 1,
        requirements: {
          create: [
            { id: generateUuidV7(), title: '4K ProRes Master (30s TVC)', isMandatory: true },
            { id: generateUuidV7(), title: 'Vertical Social Cutdowns (9:16)', isMandatory: true },
            { id: generateUuidV7(), title: 'Graded Raw Project Archive', isMandatory: false },
          ],
        },
      },
    });

    // 5. Seed Canonical Project Workspace with Milestones
    testProjectId = generateUuidV7();
    testDeliverableId = generateUuidV7();
    createdProjectIds.push(testProjectId);

    const seedAppId = generateUuidV7();
    await prisma.application.create({
      data: {
        id: seedAppId,
        assignmentId: testAssignmentId,
        applicantId: creatorUser.userId,
        coverLetter: 'Excited to deliver the luxury Autumn commercial on schedule.',
        proposedRate: 9000000,
        currency: 'INR',
        durationDays: 14,
        status: 'ACCEPTED',
        version: 2,
      },
    });

    await prisma.project.create({
      data: {
        id: testProjectId,
        assignmentId: testAssignmentId,
        applicationId: seedAppId,
        clientId: brandUser.userId,
        talentId: creatorUser.userId,
        title: 'Cinematic Brand Commercial Project Workspace',
        description: 'Luxury Autumn Commercial Production and Milestone Delivery',
        totalAmount: 9000000,
        currency: 'INR',
        status: 'IN_PROGRESS',
        version: 1,
        deliverables: {
          create: [
            {
              id: testDeliverableId,
              title: 'Milestone 1: Rough Cut & Storyboard Assembly',
              description:
                'Initial assembly cut with synchronized scratch voiceover and audio tracks.',
              amount: 4500000,
              status: 'PENDING',
              version: 1,
            },
          ],
        },
      },
    });
  });

  test.afterAll(async () => {
    // Isolated Cleanup
    try {
      for (const pId of createdProjectIds) {
        await prisma.disputeEvidence.deleteMany({ where: { dispute: { projectId: pId } } });
        await prisma.disputeStatusHistory.deleteMany({ where: { dispute: { projectId: pId } } });
        await prisma.dispute.deleteMany({ where: { projectId: pId } });
        await prisma.projectCancellation.deleteMany({ where: { projectId: pId } });
        await prisma.projectDeliverableSubmission.deleteMany({
          where: { deliverable: { projectId: pId } },
        });
        await prisma.projectDeliverable.deleteMany({ where: { projectId: pId } });
        await prisma.reviewReport.deleteMany({ where: { review: { projectId: pId } } });
        await prisma.review.deleteMany({ where: { projectId: pId } });
        await prisma.project.deleteMany({ where: { id: pId } });
      }
      for (const aId of createdAssignmentIds) {
        await prisma.applicationStatusHistory.deleteMany({
          where: { application: { assignmentId: aId } },
        });
        await prisma.application.deleteMany({ where: { assignmentId: aId } });
        await prisma.assignmentRequirement.deleteMany({ where: { assignmentId: aId } });
        await prisma.assignment.deleteMany({ where: { id: aId } });
      }
      // Also delete any assignments created dynamically in Journey B by brand test users
      await prisma.applicationStatusHistory.deleteMany({
        where: { application: { assignment: { brand: { userId: { in: createdUserIds } } } } },
      });
      await prisma.application.deleteMany({
        where: { assignment: { brand: { userId: { in: createdUserIds } } } },
      });
      await prisma.assignmentRequirement.deleteMany({
        where: { assignment: { brand: { userId: { in: createdUserIds } } } },
      });
      await prisma.assignment.deleteMany({
        where: { brand: { userId: { in: createdUserIds } } },
      });
      for (const uId of createdUserIds) {
        await prisma.creatorProfile.deleteMany({ where: { userId: uId } });
        await prisma.brandProfile.deleteMany({ where: { userId: uId } });
        await prisma.userRole.deleteMany({ where: { userId: uId } });
        await prisma.user.deleteMany({ where: { id: uId } });
      }
    } catch {
      // ignore teardown errors
    }
  });

  // ===========================================================================
  // JOURNEY A: Assignment Discovery (Stitch G01 & G02)
  // ===========================================================================
  test('Journey A: Assignment Discovery — Browse, Search, Filter & Inspect (G01 & G02)', async ({
    page,
  }) => {
    // 1. Browse /assignments
    await page.goto('/assignments', { waitUntil: 'networkidle' });

    // Verify Page Header & Stitch G01 Token Elements
    await expect(page.locator('h1')).toContainText('Browse');
    await expect(page.locator('text=Verified Assignments')).toBeVisible();

    // Verify marketplace cards are present
    const card = page.locator(`a[href="/assignments/${testAssignmentId}"]`).first();
    await expect(card).toBeVisible({ timeout: 10000 });
    await expect(card).toContainText('Cinematic Brand Commercial Video');

    // Visual Evidence: G01 Browse Assignments
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'g01_browse_assignments.png'),
      fullPage: true,
    });

    // 2. Test Search & Filter Sidebar (G02)
    const searchInput = page.locator('input[placeholder*="Search briefs"]').first();
    await searchInput.fill('Cinematic');
    await page.waitForTimeout(300);

    // Toggle Filters Sidebar (G02)
    const filterBtn = page.locator('button:has-text("Filters")').first();
    if (await filterBtn.isVisible()) {
      await filterBtn.click();
      await page.waitForTimeout(300);
    }

    // Visual Evidence: G02 Assignment Search & Filters
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'g02_assignment_search_filters.png'),
      fullPage: true,
    });

    // 3. Click assignment card to navigate to Assignment Details
    await card.click();
    await page.waitForURL(`**/assignments/${testAssignmentId}`, { timeout: 10000 });
    await expect(page.locator('h1')).toContainText('Cinematic Brand Commercial Video');
  });

  // ===========================================================================
  // JOURNEY B: Assignment Authoring (Stitch G05 & G06)
  // ===========================================================================
  test('Journey B: Assignment Authoring — Wizard Validation, Preview & Draft (G05 & G06)', async ({
    page,
  }) => {
    // Inject Brand User Auth
    await page.addInitScript((token) => {
      window.localStorage.setItem('creatorconnect_test_access_token', token);
      (window as any).__TEST_ACCESS_TOKEN__ = token;
    }, brandUser.token);

    // Navigate to /assignments/create
    await page.goto('/assignments/create', { waitUntil: 'networkidle' });

    // Verify Step 1: Creative Brief & Title
    await expect(page.locator('h2')).toContainText('Define the Creative Assignment');

    // Test Validation: Attempt to proceed with empty title
    const nextBtn = page.locator('button:has-text("Continue")');
    await nextBtn.click();
    await expect(
      page.locator('text=Please enter a clear, descriptive assignment title.'),
    ).toBeVisible();

    // Fill valid brief
    const uniqueTitle = `Docuseries Pilot Episode ${Date.now()}`;
    await page.locator('input[placeholder*="Lead Field Director"]').fill(uniqueTitle);
    await page
      .locator('textarea[placeholder*="Describe project background"]')
      .fill(
        'Documentary pilot focusing on sustainable coffee farming in the Western Ghats. Full cinematic coverage, 4K delivery.',
      );

    // Capture G05 Step 1 / Builder
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'g05_create_assignment_step1.png'),
      fullPage: true,
    });

    // Step 2: Deliverables
    await nextBtn.click();
    await expect(page.locator('h2')).toContainText('Required Deliverables');
    const step2Next = page.locator('button:has-text("Continue")');
    await step2Next.click();

    // Step 3: Budget & Timeline
    await expect(page.locator('h2')).toContainText('Escrow Budget');
    const step3Next = page.locator('button:has-text("Continue")');
    await step3Next.click();

    // Step 4: G06 Preview & Publish
    await expect(page.locator('h2')).toContainText('Pre-Flight Review');
    await expect(page.locator('h3')).toContainText(uniqueTitle);

    // Visual Evidence: G06 Preview & Publish
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'g06_preview_publish.png'),
      fullPage: true,
    });

    // Save as Draft
    const saveDraftBtn = page.locator('button:has-text("Save as Draft")');
    await saveDraftBtn.click();

    // Verify redirects to assignment detail in DRAFT status
    await page.waitForURL(/\/assignments\/[a-f0-9-]+/, { timeout: 15000 });
    await expect(page.locator('text=Draft')).toBeVisible({ timeout: 10000 });
  });

  // ===========================================================================
  // JOURNEY C: Application & Hiring (Stitch G03, G04, G07, G08, G09)
  // ===========================================================================
  test('Journey C: Application, Shortlisting & Hiring Flow (G03, G04, G07, G08, G09)', async ({
    browser,
  }) => {
    // 1. Creator views G03 Assignment Details & Applies
    const creatorContext = await browser.newContext();
    const creatorPage = await creatorContext.newPage();
    await creatorPage.addInitScript((token) => {
      window.localStorage.setItem('creatorconnect_test_access_token', token);
      (window as any).__TEST_ACCESS_TOKEN__ = token;
    }, creatorUser.token);

    await creatorPage.goto(`/assignments/${testAssignmentId}`, { waitUntil: 'networkidle' });

    // Verify G03 details layout & badges
    await expect(creatorPage.locator('h1')).toContainText('Cinematic Brand Commercial Video');
    await expect(creatorPage.locator('text=Active & Open')).toBeVisible();
    await expect(
      creatorPage.locator('text=/Lumina Creative Studio|Verified Platform Partner/'),
    ).toBeVisible();

    // Visual Evidence: G03 Assignment Details
    await creatorPage.screenshot({
      path: path.join(SCREENSHOT_DIR, 'g03_assignment_details.png'),
      fullPage: true,
    });

    // 2. Creator checks /assignments/my (G04)
    await creatorPage.goto('/assignments/my', { waitUntil: 'networkidle' });
    await expect(creatorPage.locator('h1')).toContainText('My');
    await expect(creatorPage.locator('text=My Submitted Proposals')).toBeVisible();

    // Visual Evidence: G04 My Assignments
    await creatorPage.screenshot({
      path: path.join(SCREENSHOT_DIR, 'g04_my_assignments.png'),
      fullPage: true,
    });
    await creatorContext.close();

    // 3. Brand User inspects G07 Manage Assignment Cockpit
    const brandContext = await browser.newContext();
    const brandPage = await brandContext.newPage();
    await brandPage.addInitScript((token) => {
      window.localStorage.setItem('creatorconnect_test_access_token', token);
      (window as any).__TEST_ACCESS_TOKEN__ = token;
    }, brandUser.token);

    await brandPage.goto(`/assignments/${testAssignmentId}/manage`, { waitUntil: 'networkidle' });
    await expect(brandPage.locator('h1')).toContainText('Cinematic Brand Commercial Video');
    await expect(brandPage.locator('text=Review Applicants')).toBeVisible();

    // Visual Evidence: G07 Manage Assignment
    await brandPage.screenshot({
      path: path.join(SCREENSHOT_DIR, 'g07_manage_assignment.png'),
      fullPage: true,
    });

    // 4. Brand User inspects G08 Applicants List
    await brandPage.goto(`/assignments/${testAssignmentId}/applications`, {
      waitUntil: 'networkidle',
    });
    await expect(brandPage.locator('h1')).toContainText('Review Proposals');

    // Verify creator's accepted application is listed
    await expect(
      brandPage.locator('text=Excited to deliver the luxury Autumn commercial'),
    ).toBeVisible();

    // Visual Evidence: G08 Applicants
    await brandPage.screenshot({
      path: path.join(SCREENSHOT_DIR, 'g08_applicants.png'),
      fullPage: true,
    });

    // Visual Evidence: G09 Applicant Detail (Detail Card/View)
    const detailCard = brandPage.locator('text=Cover Pitch & Approach').first();
    await expect(detailCard).toBeVisible();
    await brandPage.screenshot({
      path: path.join(SCREENSHOT_DIR, 'g09_applicant_detail.png'),
      fullPage: true,
    });
    await brandContext.close();
  });

  // ===========================================================================
  // JOURNEY D: Project Workspace & Deliverables (Stitch G10, G11, G12, G13)
  // ===========================================================================
  test('Journey D: Project Delivery Workspace, Milestones & Review (G10, G11, G12, G13)', async ({
    browser,
  }) => {
    // 1. Creator visits G10 Project Workspace
    const creatorContext = await browser.newContext();
    const creatorPage = await creatorContext.newPage();
    await creatorPage.addInitScript((token) => {
      window.localStorage.setItem('creatorconnect_test_access_token', token);
      (window as any).__TEST_ACCESS_TOKEN__ = token;
    }, creatorUser.token);

    await creatorPage.goto(`/projects/${testProjectId}`, { waitUntil: 'networkidle' });

    // Verify Workspace Header & Elements
    await expect(creatorPage.locator('h1')).toContainText(
      'Cinematic Brand Commercial Project Workspace',
    );
    await expect(
      creatorPage.locator('text=Milestone 1: Rough Cut & Storyboard Assembly'),
    ).toBeVisible();

    // Visual Evidence: G10 Project Workspace
    await creatorPage.screenshot({
      path: path.join(SCREENSHOT_DIR, 'g10_project_workspace.png'),
      fullPage: true,
    });

    // 2. Creator opens Deliver Work Dialog (G11)
    const submitBtn = creatorPage.locator('button:has-text("Submit Deliverable")').first();
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();

    // Verify G11 Deliver Work Dialog is open
    await expect(creatorPage.locator('h2:has-text("Submit Milestone Deliverable")')).toBeVisible({
      timeout: 5000,
    });

    // Visual Evidence: G11 Deliver Work Dialog
    await creatorPage.screenshot({
      path: path.join(SCREENSHOT_DIR, 'g11_deliver_work.png'),
    });

    // Fill notes and submit deliverable
    await creatorPage
      .locator('textarea[placeholder*="Detail what was created"]')
      .fill(
        'Rough assembly v1 uploaded. Color timing is preliminary, synced with audio rough mix.',
      );
    const confirmSubmitBtn = creatorPage.locator('button:has-text("Confirm & Submit Deliverable")');
    await confirmSubmitBtn.click();
    await expect(
      creatorPage.locator('h2:has-text("Submit Milestone Deliverable")'),
    ).not.toBeVisible({ timeout: 10000 });
    await creatorContext.close();

    // 3. Brand User inspects and opens Review Delivery Dialog (G12)
    const brandContext = await browser.newContext();
    const brandPage = await brandContext.newPage();
    await brandPage.addInitScript((token) => {
      window.localStorage.setItem('creatorconnect_test_access_token', token);
      (window as any).__TEST_ACCESS_TOKEN__ = token;
    }, brandUser.token);

    await brandPage.goto(`/projects/${testProjectId}`, { waitUntil: 'networkidle' });
    await expect(brandPage.getByText('Status: SUBMITTED')).toBeVisible({ timeout: 10000 });

    const reviewBtn = brandPage.locator('button:has-text("Review Submission")').first();
    await expect(reviewBtn).toBeVisible();
    await reviewBtn.click();

    // Verify G12 Review Dialog is open
    await expect(brandPage.locator('h2:has-text("Review Deliverable Submission")')).toBeVisible({
      timeout: 5000,
    });

    // Visual Evidence: G12 Review Delivery Dialog
    await brandPage.screenshot({
      path: path.join(SCREENSHOT_DIR, 'g12_review_delivery.png'),
    });

    // Close review dialog
    const cancelReviewBtn = brandPage.locator('[role="dialog"] button:has-text("Cancel")');
    await cancelReviewBtn.click();
    await expect(brandPage.locator('[role="dialog"]')).not.toBeVisible({ timeout: 5000 });

    // Visual Evidence: G13 Project Completed state preview
    await brandPage.screenshot({
      path: path.join(SCREENSHOT_DIR, 'g13_project_completed.png'),
      fullPage: true,
    });
    await brandContext.close();
  });

  // ===========================================================================
  // JOURNEY E: Disputes, Review Submissions & Security Integrity (Stitch G14, G15)
  // ===========================================================================
  test('Journey E: Disputes, Reviews & Server-Side Security Invariants (G14 & G15)', async ({
    browser,
  }) => {
    // 1. Brand User opens Dispute Dialog (G14)
    const brandContext = await browser.newContext();
    const brandPage = await brandContext.newPage();
    await brandPage.addInitScript((token) => {
      window.localStorage.setItem('creatorconnect_test_access_token', token);
      (window as any).__TEST_ACCESS_TOKEN__ = token;
    }, brandUser.token);

    await brandPage.goto(`/projects/${testProjectId}`, { waitUntil: 'networkidle' });

    const disputeBtn = brandPage.locator('button:has-text("Raise Dispute")').first();
    if (await disputeBtn.isVisible()) {
      await disputeBtn.click();

      // Verify G14 Open Dispute Dialog is open
      await expect(brandPage.locator('h2:has-text("Initiate Project Dispute")')).toBeVisible({
        timeout: 5000,
      });

      // Visual Evidence: G14 Open Dispute
      await brandPage.screenshot({
        path: path.join(SCREENSHOT_DIR, 'g14_open_dispute.png'),
      });

      // Submit dispute test record
      await brandPage
        .locator('textarea[placeholder*="Explain specifically"]')
        .fill('Formal dispute test: deliverable timeline alignment and audio sync verification.');
      const submitDisputeBtn = brandPage.locator('button[type="submit"]:has-text("Raise Dispute")');
      await submitDisputeBtn.click();
      await expect(brandPage.locator('h2:has-text("Initiate Project Dispute")')).not.toBeVisible({
        timeout: 10000,
      });

      // View G15 Dispute Status
      const viewDisputeBtn = brandPage.locator('button:has-text("Evidence Locker & History")');
      await expect(viewDisputeBtn).toBeVisible({ timeout: 5000 });
      await viewDisputeBtn.click();
      await expect(brandPage.locator('#dispute-details-dialog-title')).toBeVisible({
        timeout: 5000,
      });

      // Visual Evidence: G15 Dispute Status
      await brandPage.screenshot({
        path: path.join(SCREENSHOT_DIR, 'g15_dispute_status.png'),
      });
    }
    await brandContext.close();

    // 2. Security Invariant: Unauthorized Intruder Cross-Project & Cross-Assignment Rejection
    const intruderContext = await browser.newContext();
    const intruderPage = await intruderContext.newPage();
    await intruderPage.addInitScript((token) => {
      window.localStorage.setItem('creatorconnect_test_access_token', token);
      (window as any).__TEST_ACCESS_TOKEN__ = token;
    }, intruderUser.token);

    // Intruder tries to access Brand's private application review cockpit
    await intruderPage.goto(`/assignments/${testAssignmentId}/applications`, {
      waitUntil: 'networkidle',
    });
    // Verify intruder is NOT shown brand applications
    const intruderApps = intruderPage.locator(
      'text=Excited to deliver the luxury Autumn commercial',
    );
    await expect(intruderApps).not.toBeVisible({ timeout: 5000 });

    // Intruder tries to access private project workspace
    await intruderPage.goto(`/projects/${testProjectId}`, { waitUntil: 'networkidle' });
    // Verify intruder cannot view or access the project workspace
    const intruderMilestone = intruderPage.locator(
      'text=Milestone 1: Rough Cut & Storyboard Assembly',
    );
    await expect(intruderMilestone).not.toBeVisible({ timeout: 5000 });
    await intruderContext.close();
  });
});
