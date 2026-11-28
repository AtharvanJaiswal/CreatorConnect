/**
 * Centralized, reusable audit metadata sanitizer.
 * Guarantees that sensitive credentials, session tokens, API keys,
 * payment secrets, connection strings, and private auth headers are
 * never leaked through the administrative audit trail.
 *
 * Properties:
 * - Non-mutating (creates fresh sanitized copies)
 * - Deterministic & idempotent: S(S(x)) = S(x)
 * - Cycle-safe (ancestor WeakSet tracking)
 * - Resource-bounded (depth <= 8, keys <= 100, array items <= 50, string length <= 1024)
 * - Prototype-pollution immune
 */

const SENSITIVE_KEY_REGEX =
  /(password|passwd|secret|token|session|apiKey|api_key|auth|cookie|card|cvv|cvc|pin|accountNumber|account_number|routingNumber|routing_number|privateKey|private_key|ssn|taxId|tax_id|credential|signature|csrf|bearer|connectionString|connection_string|databaseUrl|database_url|salt|otp|passport|aadhaar)/i;

const DANGEROUS_PROTOTYPE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

const MAX_SANITIZATION_DEPTH = 8;
const MAX_ARRAY_ITEMS = 50;
const MAX_OBJECT_KEYS = 100;
const MAX_STRING_LENGTH = 1024;
const TRUNC_SUFFIX = '...[TRUNCATED]';

export function sanitizeAuditMetadata(
  data: unknown,
  depth = 0,
  seen: WeakSet<object> = new WeakSet<object>(),
): Record<string, unknown> | null {
  if (data === null || data === undefined || typeof data !== 'object') {
    return null;
  }

  if (
    data instanceof Date ||
    data instanceof RegExp ||
    data instanceof Error ||
    Buffer.isBuffer(data) ||
    data instanceof Uint8Array
  ) {
    return null;
  }

  if (depth > MAX_SANITIZATION_DEPTH) {
    return { _truncated: '[MAX_DEPTH_EXCEEDED]' };
  }

  if (seen.has(data)) {
    return { _circular: '[CIRCULAR]' };
  }

  seen.add(data);
  try {
    if (Array.isArray(data)) {
      return {
        items: sanitizeArray(data, depth + 1, seen),
      };
    }

    if (data instanceof Map) {
      return sanitizePlainObject(Object.fromEntries(data.entries()), depth, seen);
    }

    if (data instanceof Set) {
      return {
        items: sanitizeArray(Array.from(data.values()), depth + 1, seen),
      };
    }

    return sanitizePlainObject(data as Record<string, unknown>, depth, seen);
  } catch {
    return { _sanitizationError: '[SANITIZATION_FAILED_REDACTED]' };
  } finally {
    seen.delete(data);
  }
}

function sanitizePlainObject(
  obj: Record<string, unknown>,
  depth: number,
  seen: WeakSet<object>,
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  const keys = Object.keys(obj);
  const hasKeyOverflow = keys.length > MAX_OBJECT_KEYS;
  const limit = hasKeyOverflow ? MAX_OBJECT_KEYS - 1 : keys.length;

  for (let i = 0; i < limit; i++) {
    const key = keys[i];
    if (key === undefined || DANGEROUS_PROTOTYPE_KEYS.has(key)) {
      continue;
    }

    let rawVal: unknown;
    try {
      rawVal = obj[key];
    } catch {
      rawVal = '[UNREADABLE]';
    }

    const sanitizedVal = SENSITIVE_KEY_REGEX.test(key)
      ? '[REDACTED]'
      : sanitizeValue(rawVal, depth + 1, seen);

    Object.defineProperty(sanitized, key, {
      value: sanitizedVal,
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }

  if (hasKeyOverflow) {
    Object.defineProperty(sanitized, '_truncatedKeys', {
      value: '[MAX_KEYS_EXCEEDED]',
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }

  return sanitized;
}

function sanitizeArray(arr: unknown[], depth: number, seen: WeakSet<object>): unknown[] {
  if (depth > MAX_SANITIZATION_DEPTH) {
    return ['[MAX_DEPTH_EXCEEDED]'];
  }

  const hasOverflow = arr.length > MAX_ARRAY_ITEMS;
  const limit = hasOverflow ? MAX_ARRAY_ITEMS - 1 : arr.length;
  const result: unknown[] = [];

  for (let i = 0; i < limit; i++) {
    result.push(sanitizeValue(arr[i], depth, seen));
  }

  if (hasOverflow) {
    result.push('[TRUNCATED_ARRAY]');
  }

  return result;
}

function sanitizeString(val: string): string {
  // Redact embedded connection strings with credentials
  let processed = val.replace(
    /\b(?:postgres|postgresql|mysql|mongodb(?:\+srv)?|redis|rediss|amqps?):\/\/[^\s@]+@[^\s'"]+/gi,
    '[REDACTED_CONNECTION_STRING]',
  );

  // Redact PEM private keys
  if (/-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/i.test(processed)) {
    return '[REDACTED_PRIVATE_KEY]';
  }

  // Redact Bearer headers or raw JWTs
  if (/^Bearer\s+\S+$/i.test(processed.trim())) {
    return '[REDACTED]';
  }
  if (
    /^[A-Za-z0-9\-_=]+\.[A-Za-z0-9\-_=]+\.[A-Za-z0-9\-_.+/=]+$/.test(processed) &&
    processed.length > 40
  ) {
    return '[REDACTED]';
  }

  // Redact common secret key prefixes
  processed = processed.replace(
    /\b(?:sk_live|sk_test|rk_live|rk_test|ghp|gho|xoxb|xoxp|AKIA)[A-Za-z0-9_-]{8,}\b/g,
    '[REDACTED]',
  );

  if (processed.length > MAX_STRING_LENGTH) {
    return processed.slice(0, MAX_STRING_LENGTH - TRUNC_SUFFIX.length) + TRUNC_SUFFIX;
  }

  return processed;
}

function sanitizeValue(val: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (val === null || val === undefined) {
    return val ?? null;
  }

  if (typeof val === 'string') {
    return sanitizeString(val);
  }

  if (typeof val === 'number') {
    return Number.isFinite(val) ? val : null;
  }

  if (typeof val === 'boolean') {
    return val;
  }

  if (typeof val === 'bigint') {
    return val.toString();
  }

  if (typeof val === 'function' || typeof val === 'symbol') {
    return '[UNSERIALIZABLE]';
  }

  if (val instanceof Date) {
    return isNaN(val.getTime()) ? '[INVALID_DATE]' : val.toISOString();
  }

  if (Buffer.isBuffer(val) || val instanceof Uint8Array) {
    return '[BINARY_REDACTED]';
  }

  if (val instanceof RegExp) {
    return sanitizeString(val.toString());
  }

  if (val instanceof Error) {
    return {
      name: sanitizeString(val.name),
      message: sanitizeString(val.message),
    };
  }

  if (typeof val === 'object') {
    if (depth > MAX_SANITIZATION_DEPTH) {
      return '[MAX_DEPTH_EXCEEDED]';
    }
    if (seen.has(val)) {
      return '[CIRCULAR]';
    }

    seen.add(val);
    try {
      if (Array.isArray(val)) {
        return sanitizeArray(val, depth + 1, seen);
      }
      if (val instanceof Map) {
        return sanitizePlainObject(Object.fromEntries(val.entries()), depth, seen);
      }
      if (val instanceof Set) {
        return sanitizeArray(Array.from(val.values()), depth + 1, seen);
      }
      return sanitizePlainObject(val as Record<string, unknown>, depth, seen);
    } finally {
      seen.delete(val);
    }
  }

  return null;
}
