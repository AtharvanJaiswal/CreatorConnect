import { describe, it, expect } from 'vitest';
import { calculateRetryDelayMs } from '@creatorconnect/database';

describe('Transactional Outbox Backoff Mathematics (calculateRetryDelayMs)', () => {
  it('computes attempt 1 with deterministic random within [baseDelay, baseDelay + jitter)', () => {
    const delayMin = calculateRetryDelayMs(1, {
      baseDelayMs: 100,
      maxDelayMs: 30000,
      jitterMs: 50,
      randomFn: () => 0,
    });
    expect(delayMin).toBe(100);

    const delayMax = calculateRetryDelayMs(1, {
      baseDelayMs: 100,
      maxDelayMs: 30000,
      jitterMs: 50,
      randomFn: () => 0.999999,
    });
    expect(delayMax).toBe(149);
  });

  it('grows exponentially with zero jitter', () => {
    const opts = { baseDelayMs: 100, maxDelayMs: 30000, jitterMs: 0 };
    expect(calculateRetryDelayMs(1, opts)).toBe(100);
    expect(calculateRetryDelayMs(2, opts)).toBe(200);
    expect(calculateRetryDelayMs(3, opts)).toBe(400);
    expect(calculateRetryDelayMs(4, opts)).toBe(800);
    expect(calculateRetryDelayMs(5, opts)).toBe(1600);
  });

  it('strictly enforces maxDelayMs upper bound even with maximum jitter (Invariant Proof)', () => {
    // Attempt 10: 100 * 2^9 = 51200 > 30000 (cap reached)
    const delay = calculateRetryDelayMs(10, {
      baseDelayMs: 100,
      maxDelayMs: 30000,
      jitterMs: 500,
      randomFn: () => 0.999999,
    });

    // Invariant: total delay must NEVER exceed maxDelayMs
    expect(delay).toBe(30000);
    expect(delay).toBeLessThanOrEqual(30000);
  });

  it('strictly bounds delay when jitter would otherwise push uncapped exponential past maxDelayMs', () => {
    // baseDelay = 250, attempt 7: 250 * 2^6 = 16000. maxDelay = 16200. jitter = 500.
    // 16000 + 499 = 16499 > 16200 -> MUST cap at 16200
    const delay = calculateRetryDelayMs(7, {
      baseDelayMs: 250,
      maxDelayMs: 16200,
      jitterMs: 500,
      randomFn: () => 0.999999,
    });

    expect(delay).toBe(16200);
  });

  it('safely handles extreme attempt counts without numeric overflow or NaN', () => {
    const delayLarge = calculateRetryDelayMs(1000, {
      baseDelayMs: 100,
      maxDelayMs: 30000,
      jitterMs: 50,
    });
    expect(delayLarge).toBe(30000);
    expect(Number.isFinite(delayLarge)).toBe(true);
  });

  it('normalizes invalid or negative configurations safely', () => {
    // Attempt <= 0
    expect(calculateRetryDelayMs(0, { baseDelayMs: 100, maxDelayMs: 1000, jitterMs: 0 })).toBe(100);
    expect(calculateRetryDelayMs(-5, { baseDelayMs: 100, maxDelayMs: 1000, jitterMs: 0 })).toBe(
      100,
    );
    expect(calculateRetryDelayMs(NaN, { baseDelayMs: 100, maxDelayMs: 1000, jitterMs: 0 })).toBe(
      100,
    );
    expect(
      calculateRetryDelayMs(Infinity, { baseDelayMs: 100, maxDelayMs: 1000, jitterMs: 0 }),
    ).toBe(100);

    // Negative jitter
    expect(calculateRetryDelayMs(1, { baseDelayMs: 100, maxDelayMs: 1000, jitterMs: -20 })).toBe(
      100,
    );

    // Non-finite jitter falls back to default 50
    expect(
      calculateRetryDelayMs(1, {
        baseDelayMs: 100,
        maxDelayMs: 1000,
        jitterMs: NaN,
        randomFn: () => 0.5,
      }),
    ).toBe(125);

    // maxDelayMs < baseDelayMs is clamped to baseDelayMs
    expect(calculateRetryDelayMs(1, { baseDelayMs: 200, maxDelayMs: 50, jitterMs: 0 })).toBe(200);
    expect(calculateRetryDelayMs(2, { baseDelayMs: 200, maxDelayMs: 50, jitterMs: 0 })).toBe(200);

    // Invalid baseDelayMs falls back to default 100
    expect(calculateRetryDelayMs(1, { baseDelayMs: -50, maxDelayMs: 1000, jitterMs: 0 })).toBe(100);
    expect(calculateRetryDelayMs(1, { baseDelayMs: NaN, maxDelayMs: 1000, jitterMs: 0 })).toBe(100);
  });

  it('verifies first capped attempt and capped attempt with upper boundary jitter', () => {
    // baseDelay = 1000, maxDelay = 4000, jitter = 200
    // attempt 1: 1000
    // attempt 2: 2000
    // attempt 3: 4000 (first capped attempt)
    const opts = { baseDelayMs: 1000, maxDelayMs: 4000, jitterMs: 200 };
    expect(calculateRetryDelayMs(1, { ...opts, jitterMs: 0 })).toBe(1000);
    expect(calculateRetryDelayMs(2, { ...opts, jitterMs: 0 })).toBe(2000);
    expect(calculateRetryDelayMs(3, { ...opts, jitterMs: 0 })).toBe(4000);

    // Capped attempt with jitter at upper boundary: random = 0.9999999999999999
    const delayCappedWithJitter = calculateRetryDelayMs(3, {
      ...opts,
      randomFn: () => 0.9999999999999999,
    });
    expect(delayCappedWithJitter).toBe(4000);
    expect(delayCappedWithJitter).toBeLessThanOrEqual(opts.maxDelayMs);
  });

  it('computes nextAttemptAt timestamp satisfying 0 <= t_next - t_now <= d_max on a fixed clock across all configurations', () => {
    const fixedNow = new Date('2026-10-10T12:00:00.000Z').getTime();
    const configurations = [
      { baseDelayMs: 100, maxDelayMs: 30000, jitterMs: 50 },
      { baseDelayMs: 500, maxDelayMs: 5000, jitterMs: 250 },
      { baseDelayMs: 200, maxDelayMs: 200, jitterMs: 0 },
      { baseDelayMs: 1000, maxDelayMs: 8000, jitterMs: 1000 },
    ];

    for (const opts of configurations) {
      for (let attempt = 1; attempt <= 35; attempt++) {
        const delay = calculateRetryDelayMs(attempt, opts);
        const nextAttemptAt = new Date(fixedNow + delay);
        const diff = nextAttemptAt.getTime() - fixedNow;
        expect(diff).toBeGreaterThanOrEqual(0);
        expect(diff).toBeLessThanOrEqual(opts.maxDelayMs);
      }
    }
  });
});
