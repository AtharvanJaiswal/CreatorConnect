/**
 * Date and time utilities ensuring UTC standardization.
 */

export function toIsoUtcString(date: Date | string | number = new Date()): string {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) {
    throw new TypeError('Invalid date provided to toIsoUtcString');
  }
  return d.toISOString();
}

export function isExpired(isoTimestamp: string, now: Date = new Date()): boolean {
  const target = new Date(isoTimestamp);
  if (Number.isNaN(target.getTime())) {
    throw new TypeError('Invalid ISO timestamp provided to isExpired');
  }
  return target.getTime() < now.getTime();
}
