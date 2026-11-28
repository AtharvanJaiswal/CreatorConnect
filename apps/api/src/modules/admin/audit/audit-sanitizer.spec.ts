import { describe, expect, it } from 'vitest';
import { sanitizeAuditMetadata } from './audit-sanitizer.js';

describe('sanitizeAuditMetadata fail-closed behavior', () => {
  it('returns redacted error sentinel rather than throwing on malformed Proxy objects', () => {
    const hostileProxy = new Proxy(
      {},
      {
        ownKeys() {
          throw new Error('Synthetic Proxy trap failure');
        },
      },
    );

    const sanitized = sanitizeAuditMetadata(hostileProxy);
    expect(sanitized).toEqual({ _sanitizationError: '[SANITIZATION_FAILED_REDACTED]' });
  });

  it('strips prototype pollution keys, cycles, and secrets deterministically', () => {
    const cycle: Record<string, unknown> = {
      token: 'secret-token-value',
      safe: 'postgres://user:pass@host:5432/db',
    };
    cycle.self = cycle;
    Object.defineProperty(cycle, '__proto__', { value: { admin: true }, enumerable: true });

    const res = sanitizeAuditMetadata(cycle);
    expect(res?.token).toBe('[REDACTED]');
    expect(res?.safe).toBe('[REDACTED_CONNECTION_STRING]');
    expect(res?.self).toBe('[CIRCULAR]');
    expect(Object.prototype.hasOwnProperty.call(res, '__proto__')).toBe(false);
  });
});
