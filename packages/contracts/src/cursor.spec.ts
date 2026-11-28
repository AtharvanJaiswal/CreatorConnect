import { describe, expect, it } from 'vitest';
import {
  encodeTimestampUuidCursor,
  decodeTimestampUuidCursor,
  TIMESTAMP_UUID_CURSOR_MAX_LENGTH,
} from './cursor.js';

describe('Keyset Timestamp+UUID Cursor Codec', () => {
  const validId = '0192a0e2-1234-7000-8000-000000000099';
  const validDate = new Date('2026-11-28T07:00:00.000Z');

  it('round-trips legacy cursors without filterHash cleanly', () => {
    const encoded = encodeTimestampUuidCursor(validDate, validId, 'audit');
    const decoded = decodeTimestampUuidCursor(encoded);

    expect(decoded).not.toBeNull();
    expect(decoded!.createdAt.toISOString()).toBe(validDate.toISOString());
    expect(decoded!.id).toBe(validId);
    expect(decoded!.filterHash).toBeUndefined();
  });

  it('round-trips filter-bound cursors preserving filterHash cleanly', () => {
    const filterHash = 'a1b2c3d4e5f60708';
    const encoded = encodeTimestampUuidCursor(validDate, validId, 'audit', filterHash);
    expect(encoded.length).toBeLessThanOrEqual(TIMESTAMP_UUID_CURSOR_MAX_LENGTH);

    const decoded = decodeTimestampUuidCursor(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded!.filterHash).toBe(filterHash);
    expect(decoded!.id).toBe(validId);
    expect(decoded!.createdAt.toISOString()).toBe(validDate.toISOString());
  });

  it('rejects malformed filterHash values on encode and decode', () => {
    expect(() => encodeTimestampUuidCursor(validDate, validId, 'audit', 'ab')).toThrow();
    expect(() => encodeTimestampUuidCursor(validDate, validId, 'audit', 'bad$hash!')).toThrow();

    const tampered = Buffer.from(
      JSON.stringify({ c: validDate.toISOString(), i: validId, f: 'invalid$hash' }),
    ).toString('base64url');
    expect(decodeTimestampUuidCursor(tampered)).toBeNull();

    const nonStringFilter = Buffer.from(
      JSON.stringify({ c: validDate.toISOString(), i: validId, f: 12345 }),
    ).toString('base64url');
    expect(decodeTimestampUuidCursor(nonStringFilter)).toBeNull();
  });
});
