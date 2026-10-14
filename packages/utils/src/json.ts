/**
 * Deterministically stringifies an object by sorting object keys alphabetically.
 * Ensures that equivalent JSON structures produce identical string representations
 * and cryptographic hashes regardless of key insertion order or database storage layout (e.g. Postgres JSONB).
 */
export function canonicalJsonStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return '[' + value.map((item) => canonicalJsonStringify(item ?? null)).join(',') + ']';
  }

  const obj = value as Record<string, unknown>;
  const sortedKeys = Object.keys(obj).sort();
  const entries: string[] = [];

  for (const key of sortedKeys) {
    const val = obj[key];
    if (val !== undefined && typeof val !== 'function' && typeof val !== 'symbol') {
      entries.push(`${JSON.stringify(key)}:${canonicalJsonStringify(val)}`);
    }
  }

  return '{' + entries.join(',') + '}';
}
