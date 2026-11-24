import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReportAbuseDialog } from './report-abuse-dialog';

describe('ReportAbuseDialog (Stitch I06 Trust & Safety)', () => {
  it('renders null when isOpen is false', () => {
    const html = renderToStaticMarkup(
      <ReportAbuseDialog
        isOpen={false}
        onClose={vi.fn()}
        targetType="USER"
        targetId="0192e4ab-0000-7000-8000-000000000002"
        onSubmitReport={vi.fn()}
      />,
    );
    expect(html).toBe('');
  });

  it('renders modal with target name, violation categories, and character counter when open', () => {
    const html = renderToStaticMarkup(
      <ReportAbuseDialog
        isOpen={true}
        onClose={vi.fn()}
        targetType="USER"
        targetId="0192e4ab-0000-7000-8000-000000000002"
        targetName="Rohan K."
        onSubmitReport={vi.fn()}
      />,
    );

    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('Report Participant');
    expect(html).toContain('Target: Rohan K.');
    expect(html).toContain('Violation Category');
    expect(html).toContain('Specific Details &amp; Context');
    expect(html).toContain('0/5,000 (min 10)');
    expect(html).toContain('Spam or unsolicited messages');
    expect(html).toContain('Harassment, intimidation, or bullying');
    expect(html).toContain('Scam, fraud, or off-platform payment solicitation');
    expect(html).toContain('Submit Safety Report');
  });

  it('renders policy disclosure notice regarding false reports', () => {
    const html = renderToStaticMarkup(
      <ReportAbuseDialog
        isOpen={true}
        onClose={vi.fn()}
        targetType="MESSAGE"
        targetId="0192e4ab-0000-7000-8000-000000000003"
        onSubmitReport={vi.fn()}
      />,
    );

    expect(html).toContain('Report Content');
    expect(html).toContain(
      'Abuse reports are confidential and forwarded directly to Platform Safety.',
    );
    expect(html).toContain('False or malicious reports may result in account penalties.');
  });
});
