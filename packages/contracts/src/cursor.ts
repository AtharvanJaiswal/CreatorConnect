import { Type, type Static } from '@sinclair/typebox';

export const TIMESTAMP_UUID_CURSOR_MAX_LENGTH = 512;

export const TimestampUuidCursorSchema = Type.String({
  minLength: 1,
  maxLength: TIMESTAMP_UUID_CURSOR_MAX_LENGTH,
  description:
    'Opaque base64url cursor encoding (createdAt, id) for deterministic keyset pagination',
});
export type TimestampUuidCursor = Static<typeof TimestampUuidCursorSchema>;

export interface DecodedTimestampUuidCursor {
  createdAt: Date;
  id: string;
  filterHash?: string | undefined;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FILTER_HASH_REGEX = /^[a-zA-Z0-9_-]{4,64}$/;

/**
 * Encodes a composite (createdAt, id) tuple and optional filter fingerprint into an opaque base64url string.
 * Uses bounded O(n) native base64url encoding without regular expressions.
 */
export function encodeTimestampUuidCursor(
  createdAt: Date | string,
  id: string,
  contextLabel = 'keyset',
  filterHash?: string,
): string {
  const dateObj = typeof createdAt === 'string' ? new Date(createdAt) : createdAt;
  if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
    throw new Error(`Invalid date for ${contextLabel} cursor encoding: ${String(createdAt)}`);
  }
  if (!id || typeof id !== 'string' || !UUID_REGEX.test(id)) {
    throw new Error(`Invalid id for ${contextLabel} cursor encoding: ${String(id)}`);
  }
  if (filterHash !== undefined && !FILTER_HASH_REGEX.test(filterHash)) {
    throw new Error(`Invalid filterHash for ${contextLabel} cursor encoding`);
  }

  const payload = JSON.stringify({
    c: dateObj.toISOString(),
    i: id,
    ...(filterHash ? { f: filterHash } : {}),
  });

  return Buffer.from(payload, 'utf-8').toString('base64url');
}

/**
 * Decodes and deterministically validates an opaque base64url/base64 (createdAt, id) cursor.
 * Returns null for malformed, oversized, non-UUID, invalid-date, or unparseable input.
 * Bounded by maximum input length (512 chars) with linear O(n) character validation to prevent ReDoS.
 */
export function decodeTimestampUuidCursor(cursor: string): DecodedTimestampUuidCursor | null {
  if (!cursor || typeof cursor !== 'string' || cursor.length > TIMESTAMP_UUID_CURSOR_MAX_LENGTH) {
    return null;
  }

  try {
    for (let i = 0; i < cursor.length; i++) {
      const code = cursor.charCodeAt(i);
      if (!(
        (code >= 65 && code <= 90) || // A-Z
        (code >= 97 && code <= 122) || // a-z
        (code >= 48 && code <= 57) || // 0-9
        code === 45 || // -
        code === 95 || // _
        code === 43 || // +
        code === 47 || // /
        code === 61 // =
      )) {
        return null;
      }
    }

    // RFC 4648 padding invariant: '=' is only permitted at the end, maximum 2 padding characters
    const firstEquals = cursor.indexOf('=');
    if (firstEquals !== -1) {
      if (firstEquals < cursor.length - 2) {
        return null;
      }
      if (cursor.slice(firstEquals) !== '='.repeat(cursor.length - firstEquals)) {
        return null;
      }
    }

    const jsonStr =
      cursor.includes('+') || cursor.includes('/') || cursor.includes('=')
        ? Buffer.from(cursor, 'base64').toString('utf-8')
        : Buffer.from(cursor, 'base64url').toString('utf-8');

    const parsed: unknown = JSON.parse(jsonStr);

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }

    const record = parsed as Record<string, unknown>;
    if (
      !Object.prototype.hasOwnProperty.call(record, 'c') ||
      !Object.prototype.hasOwnProperty.call(record, 'i')
    ) {
      return null;
    }

    if (typeof record.c !== 'string' || typeof record.i !== 'string') {
      return null;
    }

    const date = new Date(record.c);
    if (isNaN(date.getTime())) {
      return null;
    }

    if (!UUID_REGEX.test(record.i)) {
      return null;
    }

    let filterHash: string | undefined;
    if (Object.prototype.hasOwnProperty.call(record, 'f') && record.f !== undefined) {
      if (typeof record.f !== 'string' || !FILTER_HASH_REGEX.test(record.f)) {
        return null;
      }
      filterHash = record.f;
    }

    return {
      createdAt: date,
      id: record.i,
      ...(filterHash ? { filterHash } : {}),
    };
  } catch {
    return null;
  }
}
