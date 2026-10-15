/**
 * Safe currency minor-unit arithmetic utilities.
 * All monetary amounts across CreatorConnect are stored as integers in lowest denomination.
 */

export function toMinorUnits(amountMajor: number): number {
  if (!Number.isFinite(amountMajor)) {
    throw new TypeError('Amount must be a finite number');
  }
  return Math.round(amountMajor * 100);
}

export function fromMinorUnits(amountMinor: number): number {
  assertValidMinorUnits(amountMinor);
  return amountMinor / 100;
}

export function assertValidMinorUnits(amountMinor: number): void {
  if (!Number.isInteger(amountMinor) || amountMinor < 0) {
    throw new RangeError(
      `Amount in minor units must be a non-negative integer, received: ${amountMinor}`,
    );
  }
}

export function formatCurrency(
  amountMinor: number,
  currency: string = 'INR',
  locale: string = 'en-IN',
): string {
  assertValidMinorUnits(amountMinor);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(fromMinorUnits(amountMinor));
}

export const MAX_SAFE_MINOR_UNITS = 2_147_483_647; // 32-bit signed integer max for PostgreSQL INTEGER

/**
 * Calculates cumulative proportional fee reversal using 64-bit integer arithmetic,
 * preventing JavaScript Number precision loss when intermediate products exceed Number.MAX_SAFE_INTEGER (2^53 - 1).
 */
export function calculateCumulativeFeeReversal(
  cumulativeAmount: number,
  platformFee: number,
  totalAmount: number,
): number {
  if (totalAmount <= 0 || cumulativeAmount <= 0 || platformFee <= 0) {
    return 0;
  }
  return Number((BigInt(cumulativeAmount) * BigInt(platformFee)) / BigInt(totalAmount));
}

/**
 * Calculates incremental fee reversal for a refund spanning cumulative amounts C1 to C2.
 * Formula: FeeReversal = T(C2) - T(C1) where T(C) = floor(C * F / A).
 * Validates preconditions: A > 0, F >= 0, 0 <= C1 <= C2 <= A.
 * Guarantees telescoping conservation across any partition of refunds.
 */
export function calculateIncrementalFeeReversal(
  c1: number,
  c2: number,
  platformFee: number,
  totalAmount: number,
): number {
  if (
    !Number.isInteger(c1) ||
    !Number.isInteger(c2) ||
    !Number.isInteger(platformFee) ||
    !Number.isInteger(totalAmount)
  ) {
    throw new TypeError('All monetary parameters must be integers in minor units');
  }
  if (totalAmount <= 0) {
    throw new RangeError('Total amount must be greater than zero');
  }
  if (platformFee < 0 || platformFee > totalAmount) {
    throw new RangeError('Platform fee must be non-negative and cannot exceed total amount');
  }
  if (c1 < 0 || c2 < c1 || c2 > totalAmount) {
    throw new RangeError(
      `Invalid refund bounds: expected 0 <= c1 (${c1}) <= c2 (${c2}) <= totalAmount (${totalAmount})`,
    );
  }
  const t1 = calculateCumulativeFeeReversal(c1, platformFee, totalAmount);
  const t2 = calculateCumulativeFeeReversal(c2, platformFee, totalAmount);
  const reversal = t2 - t1;
  if (reversal < 0 || reversal > platformFee) {
    throw new RangeError(
      `Fee reversal invariant violated: reversal ${reversal} out of range [0, ${platformFee}]`,
    );
  }
  return reversal;
}
