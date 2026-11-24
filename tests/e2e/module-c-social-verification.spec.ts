import { test, expect } from '@playwright/test';

test.describe('Milestone 2E.1: Module C Social Accounts & Verification Integration', () => {
  test.describe('Module C Social Accounts (C08–C11 & DLG-15)', () => {
    test('renders C08 Connected Social Accounts with Neo-Pop styling and discovery preview', async ({
      page,
    }) => {
      await page.goto('/profiles/me?tab=socials');

      // Verify page title and header
      await expect(page.locator('h2').first()).toContainText('Connect your');
      await expect(page.locator('text=social accounts').first()).toBeVisible();
      await expect(page.locator('text=MODULE C • STEP 05 OF 08').first()).toBeVisible();

      // Verify simulator rig
      const simBar = page.locator('aside[aria-label="Module C Simulation Rig"]').first();
      await expect(simBar).toBeVisible();

      // Verify platform cards
      await expect(page.locator('text=Instagram').first()).toBeVisible();
      await expect(page.locator('text=YouTube Channel').first()).toBeVisible();
      await expect(page.locator('text=Spotify for Podcasters').first()).toBeVisible();
      await expect(page.locator('text=LinkedIn Professional').first()).toBeVisible();

      // Verify right sidebar preview
      await expect(page.locator('text=Live Discovery Card Preview').first()).toBeVisible();
      await expect(page.locator('text=Data Privacy & Permitted Scopes').first()).toBeVisible();
      await expect(page.locator('text=Changes auto-saved to cloud draft').first()).toBeVisible();
    });

    test('exercises C09 Social Account Handoff and alternative manual verification', async ({
      page,
    }) => {
      await page.goto('/profiles/me?tab=socials');

      // Click connect on Spotify
      await page.locator('button[data-testid="btn-connect-spotify"]').click();

      // Verify C09 Handoff view appears
      await expect(page.locator('[data-testid="c09-handoff-container"]')).toBeVisible();
      await expect(page.locator('text=Connecting your Spotify for Podcasters')).toBeVisible();

      // Wait for alternative manual handle input
      const handleInput = page.locator('input[data-testid="input-manual-handle"]');
      await expect(handleInput).toBeVisible();
      await handleInput.fill('@e2e_showcase');

      // Confirm connect
      await page.locator('button[data-testid="btn-confirm-connect"]').click();

      // Verify success message
      await expect(page.locator('text=Account successfully connected!')).toBeVisible();
    });

    test('inspects C10 Connected Account Details view with reach and sync frequency', async ({
      page,
    }) => {
      await page.goto('/profiles/me?tab=socials');

      // Open Instagram Detail (C10)
      await page.locator('button[data-testid="btn-detail-instagram"]').click();

      // Verify C10 container
      await expect(page.locator('[data-testid="c10-detail-container"]')).toBeVisible();
      await expect(page.locator('h2').first()).toContainText('Instagram Details');
      await expect(page.locator('text=48,200 Public Followers').first()).toBeVisible();
      await expect(page.locator('text=Match Confirmed').first()).toBeVisible();
      await expect(page.locator('text=Active & Healthy').first()).toBeVisible();
      await expect(page.locator('text=Discovery Impact').first()).toBeVisible();

      // Return back to C08
      await page.locator('button[data-testid="btn-back-c08"]').click();
      await expect(page.locator('text=Connect your').first()).toBeVisible();
    });

    test('navigates to C11 Social Connection Error and toggles failure recovery reasons', async ({
      page,
    }) => {
      await page.goto('/profiles/me?tab=socials');

      // Toggle to OAuth Error (C11)
      await page.locator('button[data-testid="sim-btn-error"]').click();

      // Verify C11 Error container
      await expect(page.locator('[data-testid="c11-error-container"]')).toBeVisible();
      await expect(page.locator('h2').first()).toContainText(
        'We couldn’t connect your Instagram account',
      );
      await expect(page.locator('text=Helpful things to check').first()).toBeVisible();

      // Switch to session expired
      await page.locator('button[data-testid="err-subtype-session-expired"]').click();
      await expect(page.locator('text=The authorization session timed out').first()).toBeVisible();

      // Switch to rate limited
      await page.locator('button[data-testid="err-subtype-rate-limited"]').click();
      await expect(
        page.locator('text=Too many connection attempts were made').first(),
      ).toBeVisible();
    });

    test('triggers DLG-15 Disconnect Modal and confirms safety notice', async ({ page }) => {
      await page.goto('/profiles/me?tab=socials');

      // Open DLG-15
      await page.locator('button[data-testid="sim-btn-dlg15"]').click();

      const modal = page.locator('[data-testid="dlg15-modal"]');
      await expect(modal).toBeVisible();
      await expect(modal).toContainText('Disconnect Instagram?');
      await expect(modal).toContainText('unpin your verified badge');

      // Cancel
      await page.locator('button[data-testid="btn-dlg15-cancel"]').click();
      await expect(modal).not.toBeVisible();
    });
  });

  test.describe('Module C Verification Centre (C12–C14 & DLG-16/17/21)', () => {
    test('renders C12 Verification Centre with 4-stage progress timeline and status card', async ({
      page,
    }) => {
      await page.goto('/verification');

      // Verify C12 header
      await expect(page.locator('h2').first()).toContainText('Verification centre');
      await expect(page.locator('text=MODULE C • STEP 07 OF 08').first()).toBeVisible();

      // Verify stepper stages
      await expect(page.locator('text=Step 1: ID Doc').first()).toBeVisible();
      await expect(page.locator('text=Step 2: Socials').first()).toBeVisible();
      await expect(page.locator('text=Step 3: Review').first()).toBeVisible();
      await expect(page.locator('text=Step 4: Badge').first()).toBeVisible();

      // Verify advantages card
      await expect(page.locator('text=Verified Creator Advantages').first()).toBeVisible();
      await expect(page.locator('text=Zero-Access Encrypted Vault').first()).toBeVisible();
    });

    test('navigates to C13 Credential Submission Form and manages documents', async ({ page }) => {
      await page.goto('/verification');

      // Navigate to C13
      await page.locator('button[data-testid="btn-c12-start"]').click();

      // Verify C13 container
      await expect(page.locator('[data-testid="c13-request-container"]')).toBeVisible();
      await expect(page.locator('h2').first()).toContainText('Submit verification credentials');
      await expect(
        page.locator('text=1. Government Identity Document (Mandatory)').first(),
      ).toBeVisible();

      // Verify attached files
      await expect(page.locator('text=Govt_ID_Front_AanyaRao.pdf').first()).toBeVisible();
      await expect(page.locator('text=Business_GST_TaxReg_2024.pdf').first()).toBeVisible();

      // Remove one document
      await page.locator('button[data-testid="btn-remove-doc-doc-1"]').click();
      await expect(page.locator('text=Govt_ID_Front_AanyaRao.pdf')).not.toBeVisible();
    });

    test('submits verification via DLG-16 and transitions to C14 Outcome view', async ({
      page,
    }) => {
      await page.goto('/verification');

      // Go to C13
      await page.locator('button[data-testid="ver-btn-in-progress"]').first().click();

      // Open DLG-16
      await page.locator('button[data-testid="btn-open-dlg16"]').click();

      const modal = page.locator('[data-testid="dlg16-modal"]');
      await expect(modal).toBeVisible();
      await expect(modal).toContainText('Confirm Verification Submission');

      // Submit
      await page.locator('button[data-testid="btn-dlg16-confirm"]').click();

      // Verify C14 Outcome view
      await expect(page.locator('[data-testid="c14-outcome-container"]')).toBeVisible();
    });

    test('switches across all four canonical C14 outcomes (Approved, Changes, Rejected, Pending)', async ({
      page,
    }) => {
      await page.goto('/verification');

      // Switch to Outcome view via simulator
      await page.locator('button[data-testid="ver-btn-approved"]').first().click();

      // 1. Approved (Default)
      await expect(page.locator('text=Your profile is verified.').first()).toBeVisible();
      await expect(
        page.locator('text=Verification Confirmed • Tier 1 Verified Creator').first(),
      ).toBeVisible();

      // 2. Changes Required
      await page.locator('button[data-testid="tab-outcome-changes-required"]').click();
      await expect(page.locator('text=A few details need your attention.').first()).toBeVisible();
      await expect(page.locator('text=Reviewer Note: Government ID Scan').first()).toBeVisible();

      // 3. Rejected
      await page.locator('button[data-testid="tab-outcome-rejected"]').click();
      await expect(
        page.locator('text=We couldn’t verify your account at this time.').first(),
      ).toBeVisible();
      await expect(page.locator('text=Resubmission Policy').first()).toBeVisible();

      // 4. Pending / Under Review
      await page.locator('button[data-testid="tab-outcome-pending"]').click();
      await expect(
        page.locator('text=Your verification request is being reviewed.').first(),
      ).toBeVisible();
    });
  });
});
