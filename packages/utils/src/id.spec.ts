import { describe, expect, it } from 'vitest';
import { generateId, generateUuidV7 } from './id.js';

describe('UUIDv7 & ID Generation', () => {
  it('generates a valid RFC 9562 UUIDv7 format', () => {
    const id = generateUuidV7();
    // 8-4-4-4-12 hex format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(id).toMatch(uuidRegex);
    expect(id.length).toBe(36);
  });

  it('generates monotonically ordered UUIDs over time', async () => {
    const id1 = generateUuidV7();
    // small sleep to ensure timestamp progression
    await new Promise((resolve) => setTimeout(resolve, 5));
    const id2 = generateUuidV7();

    expect(id1 < id2).toBe(true);
  });

  it('generates unique IDs in batch generation', () => {
    const set = new Set<string>();
    const count = 1000;
    for (let i = 0; i < count; i++) {
      set.add(generateUuidV7());
    }
    expect(set.size).toBe(count);
  });

  it('supports domain prefixing via generateId', () => {
    const userPrefixed = generateId('usr');
    expect(userPrefixed.startsWith('usr_')).toBe(true);
    expect(userPrefixed.length).toBe(4 + 32); // usr_ + 32 hex chars without hyphens

    const raw = generateId();
    expect(raw.length).toBe(36);
  });
});
