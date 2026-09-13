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
