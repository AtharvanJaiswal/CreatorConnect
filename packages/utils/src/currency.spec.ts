import { describe, it, expect } from 'vitest';
import { toMinorUnits, fromMinorUnits, formatCurrency, assertValidMinorUnits } from './currency.js';

describe('currency utilities', () => {
  it('converts major currency units to minor units (cents/paise)', () => {
    expect(toMinorUnits(150.5)).toBe(15050);
    expect(toMinorUnits(0)).toBe(0);
    expect(toMinorUnits(99.99)).toBe(9999);
  });

  it('converts minor currency units to major units', () => {
    expect(fromMinorUnits(15050)).toBe(150.5);
    expect(fromMinorUnits(0)).toBe(0);
    expect(fromMinorUnits(9999)).toBe(99.99);
  });

  it('rejects invalid minor currency units', () => {
    expect(() => assertValidMinorUnits(-100)).toThrow(RangeError);
    expect(() => assertValidMinorUnits(15.5)).toThrow(RangeError);
  });

  it('formats currency correctly', () => {
    const formatted = formatCurrency(50000, 'INR', 'en-IN');
    expect(formatted).toContain('500');
  });
});
