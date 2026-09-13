import { describe, it, expect } from 'vitest';
import { formatCurrency, toIsoUtcString } from '@creatorconnect/utils';

describe('Web Shell Foundation Smoke Test', () => {
  it('correctly integrates with shared utils in web environment', () => {
    const formatted = formatCurrency(1000000, 'INR');
    expect(formatted).toContain('10,000');

    const dateStr = toIsoUtcString(new Date('2026-01-01T00:00:00.000Z'));
    expect(dateStr).toBe('2026-01-01T00:00:00.000Z');
  });
});
