import { test, expect } from '@playwright/test';

test.describe('Milestone 2E: Stitch Visual Parity & Journey Verification', () => {
  test.describe('Module J: City Creative Community Hub (J01-J10)', () => {
    test('renders J01 Community Home with Neo-Pop styling and metadata', async ({ page }) => {
      await page.goto('/community');

      // Verify breadcrumb and header title
      await expect(page.locator('h1').first()).toContainText('Mumbai Creators Hub');
      await expect(page.locator('text=Active local collective').first()).toBeVisible();

      // Verify QA simulation bar is present
      const qaBar = page.locator('aside[aria-label="QA Simulation Rig"]').first();
      await expect(qaBar).toBeVisible();

      // Verify city metadata tags
      await expect(page.locator('text=Mumbai, MH').first()).toBeVisible();
      await expect(page.locator('text=1,842 Members').first()).toBeVisible();
      await expect(page.locator('text=Primary Hub (Locked)').first()).toBeVisible();

      // Verify action buttons
      await expect(page.locator('button:has-text("Create Post")').first()).toBeVisible();
      await expect(page.locator('button:has-text("Hubs & Following")').first()).toBeVisible();
    });

    test('switches filter tabs (J02, J03, J04, J08, J10) accurately', async ({ page }) => {
      await page.goto('/community');

      // 1. Opportunities Tab (J02)
      await page.locator('button:has-text("Opportunities (J02)")').first().click();
      await expect(page.locator('text=Need 2x Ronin 4D Focus Pullers').first()).toBeVisible();
      await expect(page.locator('text=Verified Assignment #PRJ-9012').first()).toBeVisible();
      await expect(page.locator('text=₹54,000 Total Escrow Funded').first()).toBeVisible();

      // 2. Events Tab (J03)
      await page.locator('button:has-text("Events & Meetups (J03)")').first().click();
      await expect(page.locator('text=Mumbai Creators Monsoon Mixer').first()).toBeVisible();

      // 3. Members Directory Tab (J04)
      await page.locator('button:has-text("Members (J04)")').first().click();
      await expect(
        page.locator('text=Mumbai Verified Creative Directory (J04)').first(),
      ).toBeVisible();
      await expect(page.locator('text=Aarav Mehta').first()).toBeVisible();

      // 4. Moderation Queue Tab (J10)
      await page.locator('button:has-text("Mod Queue (J10)")').first().click();
      await expect(page.locator('text=Community Moderation Queue (J10)').first()).toBeVisible();
      await expect(page.locator('text=Flagged: Uncontracted Solicitation').first()).toBeVisible();
    });

    test('toggles QA Simulation Rig states (skeletons, empty, error, brand-limit)', async ({
      page,
    }) => {
      await page.goto('/community');

      // Test Skeletons
      await page.locator('button:has-text("Loading Skeletons")').first().click();
      const skeletonPulse = page.locator('.animate-pulse');
      await expect(skeletonPulse.first()).toBeVisible();

      // Test First-Use Empty
      await page.locator('button:has-text("First-Use Empty")').first().click();
      await expect(page.locator('text=Welcome to the Mumbai Hub!').first()).toBeVisible();
      await expect(
        page.locator('button:has-text("Start First Conversation")').first(),
      ).toBeVisible();

      // Test Feed Error
      await page.locator('button:has-text("Feed Error")').first().click();
      await expect(page.locator('text=Unable to load Mumbai hub feed').first()).toBeVisible();
      await expect(page.locator('button:has-text("Retry Feed")').first()).toBeVisible();

      // Test Brand Promo Limit
      await page.locator('button:has-text("Brand Promo Limit")').first().click();
      await expect(page.locator('text=Brand Monthly Promotion Quota Active').first()).toBeVisible();
      await expect(page.locator('text=2 of 3').first()).toBeVisible();

      // Reset to default
      await page.locator('button:has-text("Default Feed")').first().click();
      await expect(page.locator('h1').first()).toContainText('Mumbai Creators Hub');
    });

    test('interacts with applauds and opens Create Post modal (J06)', async ({ page }) => {
      await page.goto('/community');

      // Click applaud on first post
      const applaudButton = page.locator('button:has-text("Applauds")').first();
      const initialText = await applaudButton.innerText();
      await applaudButton.click();
      const afterText = await applaudButton.innerText();
      expect(afterText).not.toEqual(initialText);

      // Open Create Post Modal (J06)
      await page.locator('button:has-text("Create Post")').first().click();
      const modal = page.locator('div[role="dialog"]').first();
      await expect(modal).toBeVisible();
      await expect(modal).toContainText('Create Community Dispatch (J06)');

      // Check category selectors
      await expect(modal.locator('button:has-text("discussion")').first()).toBeVisible();
      await expect(modal.locator('button:has-text("opportunity")').first()).toBeVisible();
      await expect(modal.locator('button:has-text("event")').first()).toBeVisible();
      await expect(modal.locator('button:has-text("question")').first()).toBeVisible();

      // Close modal
      await modal.locator('button:has-text("Cancel")').first().click();
      await expect(modal).not.toBeVisible();
    });

    test('navigates to J05 Post Detail and submits comment', async ({ page }) => {
      await page.goto('/community/posts/post-1');

      // Verify article title and guide badge
      await expect(page.locator('h1').first()).toContainText(
        'Welcome to the Mumbai Summer Creative Collective',
      );
      await expect(page.locator('text=Community Guide').first()).toBeVisible();
      await expect(
        page.locator('text=CreatorConnect Trust & Escrow Guarantee').first(),
      ).toBeVisible();

      // Submit reply comment
      const commentInput = page.locator('textarea').first();
      await commentInput.fill(
        'Excited for the upcoming monsoon gear shootout! Will bring our wireless video kit.',
      );
      await page.locator('button:has-text("Post Reply")').first().click();

      // Verify new comment is displayed
      await expect(
        page.locator('text=Excited for the upcoming monsoon gear shootout!').first(),
      ).toBeVisible();
    });

    test('navigates to J07 Event Detail and toggles RSVP', async ({ page }) => {
      await page.goto('/community/events/evt-1');

      // Verify hero banner and metadata
      await expect(page.locator('h1').first()).toContainText('Mumbai Creators Monsoon Mixer');
      await expect(page.locator('text=Saturday, June 14, 2026').first()).toBeVisible();
      await expect(page.locator('text=Bandra Base').first()).toBeVisible();

      // Verify RSVP button
      const rsvpBtn = page.locator('button:has-text("Reserve Free Ticket")').first();
      await expect(rsvpBtn).toBeVisible();
      await rsvpBtn.click();

      // Check RSVP confirmed state
      await expect(page.locator('button:has-text("RSVP Confirmed")').first()).toBeVisible();
    });
  });

  test.describe('Module I07: Official Support Chat & Escrow Concierge', () => {
    test('renders authentication required screen when unauthenticated without qa_demo', async ({
      page,
    }) => {
      await page.goto('/support');
      await expect(page.locator('text=Authentication Required').first()).toBeVisible();
      await expect(page.locator('text=Sign In to Access Desk').first()).toBeVisible();
      await expect(page.locator('text=#SUP-2025-0419')).not.toBeVisible();
    });

    test('renders I07 Support Chat with Desk Verified banner & QA rig in explicit demo mode', async ({
      page,
    }) => {
      await page.goto('/support?qa_demo=true');

      // Verify official support title and verified badge
      await expect(page.locator('h1').first()).toContainText('CreatorConnect Official Support');
      await expect(page.locator('text=Desk Verified').first()).toBeVisible();
      await expect(page.locator('text=Secure Channel').first()).toBeVisible();

      // Verify safety banner
      await expect(
        page.locator('text=All communications are logged for audit compliance').first(),
      ).toBeVisible();

      // Verify ticket metadata rail
      await expect(page.locator('text=#SUP-2025-0419').first()).toBeVisible();
      await expect(
        page.locator('text=Milestone #MS-02 Disbursement Reconciliation').first(),
      ).toBeVisible();
      await expect(page.locator('text=₹1,20,000 INR').first()).toBeVisible();
    });

    test('sends support message and marks ticket resolved in demo mode', async ({ page }) => {
      await page.goto('/support?qa_demo=true');

      // Type and send message
      const chatInput = page.locator('input[placeholder*="Type official response"]').first();
      await chatInput.fill('Acknowledged receipt of the banking confirmation. Thank you Anya.');
      await chatInput.press('Enter');

      // Verify message is in stream
      await expect(
        page.locator('text=Acknowledged receipt of the banking confirmation.').first(),
      ).toBeVisible();

      // Mark inquiry resolved
      await page.locator('button:has-text("Mark Inquiry Resolved")').first().click();
      await expect(page.locator('span:has-text("Resolved")').first()).toBeVisible();
    });

    test('validates responsive layouts (Tablet & Mobile)', async ({ page }) => {
      // Tablet Viewport (768x1024)
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/community');
      await expect(page.locator('h1').first()).toContainText('Mumbai Creators Hub');

      // Mobile Viewport (375x812)
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto('/community');
      await expect(page.locator('h1').first()).toContainText('Mumbai Creators Hub');

      // Check support page on mobile in demo mode
      await page.goto('/support?qa_demo=true');
      await expect(page.locator('h1').first()).toContainText('CreatorConnect Official Support');
    });
  });
});
