import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SocialAccountsPanel } from './social-accounts-panel';
import { VerificationCentrePanel } from './verification-centre-panel';

describe('Module C: Social Accounts Panel (C08–C11 & DLG-15)', () => {
  it('renders C08 connected social channels grid and discovery preview card', () => {
    const html = renderToStaticMarkup(<SocialAccountsPanel />);

    // Header & Step indicators
    expect(html).toContain('MODULE C • STEP 05 OF 08');
    expect(html).toContain('CONNECTED SOCIAL CHANNELS');
    expect(html).toContain('Connect your');
    expect(html).toContain('social accounts');

    // Platforms
    expect(html).toContain('Instagram');
    expect(html).toContain('YouTube Channel');
    expect(html).toContain('Spotify for Podcasters');
    expect(html).toContain('LinkedIn Professional');
    expect(html).toContain('Vimeo Pro / Showcase');
    expect(html).toContain('X (formerly Twitter)');

    // Live Discovery Card Preview & Privacy
    expect(html).toContain('Live Discovery Card Preview');
    expect(html).toContain('Data Privacy &amp; Permitted Scopes');
    expect(html).toContain('Changes auto-saved to cloud draft');
    expect(html).toContain('Save and continue →');
  });

  it('renders C08 with initial connected social links passed from profile', () => {
    const html = renderToStaticMarkup(
      <SocialAccountsPanel
        initialSocialLinks={[
          { platform: 'INSTAGRAM', url: 'https://instagram.com/custom_creator' },
          { platform: 'YOUTUBE', url: 'https://youtube.com/@custom_films' },
        ]}
      />,
    );

    expect(html).toContain('custom_creator');
    expect(html).toContain('custom_films');
  });

  it('includes C08-C11 Simulator bar for design verification', () => {
    const html = renderToStaticMarkup(<SocialAccountsPanel />);
    expect(html).toContain('Module C • C08–C11 Simulator');
    expect(html).toContain('Default (Mixed C08)');
    expect(html).toContain('All Disconnected');
    expect(html).toContain('OAuth Error (C11)');
    expect(html).toContain('Empty (No Platforms)');
    expect(html).toContain('DLG-15 Disconnect Modal');
  });
});

describe('Module C: Verification Centre Panel (C12–C14 & DLG-16/17/21)', () => {
  it('renders C12 Verification Centre with 4-step progress stepper and status card', () => {
    const html = renderToStaticMarkup(<VerificationCentrePanel initialIsVerified={false} />);

    // Header & Subtitle
    expect(html).toContain('MODULE C • STEP 07 OF 08');
    expect(html).toContain('Verification');
    expect(html).toContain('centre');

    // Stepper stages
    expect(html).toContain('Step 1: ID Doc');
    expect(html).toContain('Step 2: Socials');
    expect(html).toContain('Step 3: Review');
    expect(html).toContain('Step 4: Badge');

    // Verified Creator Advantages
    expect(html).toContain('Verified Creator Advantages');
    expect(html).toContain('4.2x Higher Agency Brief Matches');
    expect(html).toContain('Zero-Access Encrypted Vault');
  });

  it('renders C12 approved state when initialIsVerified is true', () => {
    const html = renderToStaticMarkup(<VerificationCentrePanel initialIsVerified={true} />);
    expect(html).toContain('Approved / Verified ✓');
    expect(html).toContain('Your Marketplace Profile is Authoritatively Verified');
  });

  it('includes C12-C14 Simulator bar for state inspection', () => {
    const html = renderToStaticMarkup(<VerificationCentrePanel />);
    expect(html).toContain('Module C • C12–C14 Simulator');
    expect(html).toContain('Not Started');
    expect(html).toContain('Request Form (C13)');
    expect(html).toContain('Under Review (C12)');
    expect(html).toContain('Outcome (C14)');
    expect(html).toContain('DLG-21 Modal');
  });
});
