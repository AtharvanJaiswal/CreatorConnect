import { describe, it, expect } from 'vitest';
import {
  toMinorUnits,
  fromMinorUnits,
  formatCurrency,
  assertValidMinorUnits,
  calculateCumulativeFeeReversal,
  MAX_SAFE_MINOR_UNITS,
} from './currency.js';

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

  describe('calculateCumulativeFeeReversal', () => {
    it('returns 0 when totalAmount, cumulativeAmount, or platformFee is <= 0', () => {
      expect(calculateCumulativeFeeReversal(0, 1000, 10000)).toBe(0);
      expect(calculateCumulativeFeeReversal(5000, 0, 10000)).toBe(0);
      expect(calculateCumulativeFeeReversal(5000, 1000, 0)).toBe(0);
    });

    it('calculates exact integer floored cumulative fee reversal', () => {
      // 3,000 * 1,200 / 10,000 = 360
      expect(calculateCumulativeFeeReversal(3000, 1200, 10000)).toBe(360);
      // 1 * 10 / 100 = 0
      expect(calculateCumulativeFeeReversal(1, 10, 100)).toBe(0);
      // 10 * 10 / 100 = 1
      expect(calculateCumulativeFeeReversal(10, 10, 100)).toBe(1);
    });

    it('prevents JavaScript Number precision loss when intermediate product exceeds Number.MAX_SAFE_INTEGER', () => {
      // MAX_SAFE_INTEGER is 9,007,199,254,740,991 (~9e15).
      // If amount = 1,000,000,000 (1e9 paise) and fee = 100,000,000 (1e8 paise):
      // intermediate product is 1e17, which exceeds Number.MAX_SAFE_INTEGER.
      // Standard JS float multiplication would lose lower bit precision.
      // BigInt arithmetic computes: (1_000_000_000 * 100_000_000) / 1_000_000_000 = 100_000_000 exactly.
      const largeCumulative = 1_000_000_000;
      const largeFee = 100_000_000;
      const largeTotal = 1_000_000_000;
      expect(calculateCumulativeFeeReversal(largeCumulative, largeFee, largeTotal)).toBe(
        100_000_000,
      );
    });
  });
});
