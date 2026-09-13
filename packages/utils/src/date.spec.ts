import { describe, it, expect } from 'vitest';
import { toIsoUtcString, isExpired } from './date.js';

describe('date utilities', () => {
  it('converts valid Date to ISO UTC string', () => {
    const d = new Date('2026-09-13T12:00:00.000Z');
    expect(toIsoUtcString(d)).toBe('2026-09-13T12:00:00.000Z');
  });

  it('throws on invalid date input', () => {
    expect(() => toIsoUtcString('invalid-date-string')).toThrow(TypeError);
  });

  it('correctly calculates timestamp expiry', () => {
    const past = new Date(Date.now() - 60000).toISOString();
    const future = new Date(Date.now() + 60000).toISOString();
    expect(isExpired(past)).toBe(true);
    expect(isExpired(future)).toBe(false);
  });
});
