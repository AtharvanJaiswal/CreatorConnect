/**
 * Unique identifier helpers with domain prefixing.
 */

export function generateId(prefix?: string): string {
  const uuid =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).substring(2) + Date.now().toString(36);

  return prefix ? `${prefix}_${uuid.replace(/-/g, '')}` : uuid;
}
