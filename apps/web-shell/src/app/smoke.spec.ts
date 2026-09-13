import { describe, it, expect } from 'vitest';
import { formatCurrency, toIsoUtcString } from '@creatorconnect/utils';
import { colors, radii } from '@creatorconnect/design-system';
import { buttonVariants, badgeVariants, cn } from '@creatorconnect/ui';

describe('Web Shell Foundation & Design System Integration', () => {
  it('correctly integrates with shared utils in web environment', () => {
    const formatted = formatCurrency(1000000, 'INR');
    expect(formatted).toContain('10,000');

    const dateStr = toIsoUtcString(new Date('2026-01-01T00:00:00.000Z'));
    expect(dateStr).toBe('2026-01-01T00:00:00.000Z');
  });

  it('correctly integrates with @creatorconnect/design-system tokens', () => {
    expect(colors.light.primary).toBeDefined();
    expect(colors.dark.primary).toBeDefined();
    expect(radii.md).toBe('0.5rem');
  });

  it('correctly integrates with @creatorconnect/ui component variants and utilities', () => {
    const btnClass = buttonVariants({ variant: 'glass' });
    expect(btnClass).toContain('glass');

    const badgeClass = badgeVariants({ variant: 'success' });
    expect(badgeClass).toContain('bg-success');

    expect(cn('p-2', 'p-4')).toBe('p-4');
  });
});
