import { describe, it, expect } from 'vitest';
import {
  toMinorUnits,
  fromMinorUnits,
  formatCurrency,
  assertValidMinorUnits,
  calculateCumulativeFeeReversal,
  calculateIncrementalFeeReversal,
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

  describe('calculateIncrementalFeeReversal (Mathematical Invariants)', () => {
    it('enforces precondition validation', () => {
      expect(() => calculateIncrementalFeeReversal(-1, 100, 50, 1000)).toThrow(RangeError);
      expect(() => calculateIncrementalFeeReversal(200, 100, 50, 1000)).toThrow(RangeError);
      expect(() => calculateIncrementalFeeReversal(0, 1100, 50, 1000)).toThrow(RangeError);
      expect(() => calculateIncrementalFeeReversal(0, 100, -5, 1000)).toThrow(RangeError);
      expect(() => calculateIncrementalFeeReversal(0, 100, 50, 0)).toThrow(RangeError);
      expect(() => calculateIncrementalFeeReversal(10.5, 100, 50, 1000)).toThrow(TypeError);
    });

    it('guarantees telescoping conservation across any partition of refunds', () => {
      const totalAmount = 10000;
      const platformFee = 1500; // 15%

      // Split 1: Uniform 4-way split [2500, 2500, 2500, 2500]
      const r1 = calculateIncrementalFeeReversal(0, 2500, platformFee, totalAmount);
      const r2 = calculateIncrementalFeeReversal(2500, 5000, platformFee, totalAmount);
      const r3 = calculateIncrementalFeeReversal(5000, 7500, platformFee, totalAmount);
      const r4 = calculateIncrementalFeeReversal(7500, 10000, platformFee, totalAmount);
      expect(r1 + r2 + r3 + r4).toBe(platformFee);

      // Split 2: Non-uniform prime/odd partition [1337, 2663, 6000]
      const p1 = calculateIncrementalFeeReversal(0, 1337, platformFee, totalAmount);
      const p2 = calculateIncrementalFeeReversal(1337, 4000, platformFee, totalAmount);
      const p3 = calculateIncrementalFeeReversal(4000, 10000, platformFee, totalAmount);
      expect(p1 + p2 + p3).toBe(platformFee);
    });

    it('guarantees non-negative reversals and upper-bound constraints', () => {
      const total = 5000;
      const fee = 600;
      for (let c1 = 0; c1 < total; c1 += 250) {
        for (let c2 = c1; c2 <= total; c2 += 250) {
          const rev = calculateIncrementalFeeReversal(c1, c2, fee, total);
          expect(rev).toBeGreaterThanOrEqual(0);
          expect(rev).toBeLessThanOrEqual(fee);
        }
      }
    });

    it('handles maximum safe minor unit boundary correctly without overflow', () => {
      const maxTotal = MAX_SAFE_MINOR_UNITS; // 2,147,483,647 paise (~₹21.47M)
      const maxFee = 214_748_364; // ~10%
      const half = Math.floor(maxTotal / 2);
      const rev1 = calculateIncrementalFeeReversal(0, half, maxFee, maxTotal);
      const rev2 = calculateIncrementalFeeReversal(half, maxTotal, maxFee, maxTotal);
      expect(rev1).toBeGreaterThan(0);
      expect(rev2).toBeGreaterThan(0);
      expect(rev1 + rev2).toBe(maxFee);
    });

    it('handles zero fee gracefully', () => {
      expect(calculateIncrementalFeeReversal(0, 500, 0, 1000)).toBe(0);
      expect(calculateIncrementalFeeReversal(500, 1000, 0, 1000)).toBe(0);
    });
  });
});
