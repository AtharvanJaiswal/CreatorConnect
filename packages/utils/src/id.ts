import { uuidv7 } from 'uuidv7';

/**
 * Generates an RFC 9562-compliant UUIDv7 string.
 * Combines 48-bit millisecond timestamp with monotonic counter and random entropy.
 */
export function generateUuidV7(): string {
  return uuidv7();
}

/**
 * Unique identifier helper with domain prefixing.
 * Uses UUIDv7 as the underlying identifier.
 */
export function generateId(prefix?: string): string {
  const uuid = generateUuidV7();
  return prefix ? `${prefix}_${uuid.replace(/-/g, '')}` : uuid;
}
