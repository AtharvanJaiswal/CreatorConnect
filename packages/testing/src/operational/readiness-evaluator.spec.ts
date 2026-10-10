import { describe, it, expect } from 'vitest';
import { ReadinessEvaluator, DEFAULT_MANDATORY_GATES } from './readiness-evaluator.js';
import type { OperationalGateResult } from './gate-types.js';

describe('ReadinessEvaluator (Fail-Closed Operational Gate Orchestrator)', () => {
  const evaluator = new ReadinessEvaluator();

  const createPassingGate = (id: string, name: string): OperationalGateResult => ({
    id,
    name,
    status: 'PASS',
    environment: 'test',
    evidence: [`${name} passed all invariant tests`],
    checkedAt: new Date().toISOString(),
  });

  it('evaluates overall PASS when all mandatory gates explicitly pass with fresh evidence', () => {
    const gates = DEFAULT_MANDATORY_GATES.map((id) => createPassingGate(id, `Gate ${id}`));
    const result = evaluator.evaluate(gates);

    expect(result.overallStatus).toBe('PASS');
    expect(result.allMandatoryPassed).toBe(true);
    expect(result.summary).toContain('All mandatory production readiness gates verified');
  });

  it('evaluates overall FAIL if any mandatory gate reports FAIL', () => {
    const gates = DEFAULT_MANDATORY_GATES.map((id) => createPassingGate(id, `Gate ${id}`));
    gates[0]!.status = 'FAIL';
    gates[0]!.reason = 'Database schema integrity failure';

    const result = evaluator.evaluate(gates);
    expect(result.overallStatus).toBe('FAIL');
    expect(result.allMandatoryPassed).toBe(false);
    expect(result.summary).toContain('one or more mandatory gates reported explicit failures');
  });

  it('evaluates overall BLOCKED if a mandatory gate is missing', () => {
    // Provide only 3 out of 4 mandatory gates
    const gates = DEFAULT_MANDATORY_GATES.slice(0, 3).map((id) =>
      createPassingGate(id, `Gate ${id}`),
    );
    const result = evaluator.evaluate(gates);

    expect(result.overallStatus).toBe('BLOCKED');
    expect(result.allMandatoryPassed).toBe(false);
    expect(result.summary).toContain('mandatory gates missing');
  });

  it('evaluates overall BLOCKED if a mandatory gate reports BLOCKED', () => {
    const gates = DEFAULT_MANDATORY_GATES.map((id) => createPassingGate(id, `Gate ${id}`));
    gates[1]!.status = 'BLOCKED';
    gates[1]!.reason = 'Monitoring collector unreachable';

    const result = evaluator.evaluate(gates);
    expect(result.overallStatus).toBe('BLOCKED');
    expect(result.allMandatoryPassed).toBe(false);
  });

  it('evaluates overall NOT_VERIFIED if any mandatory gate reports NOT_VERIFIED', () => {
    const gates = DEFAULT_MANDATORY_GATES.map((id) => createPassingGate(id, `Gate ${id}`));
    gates[2]!.status = 'NOT_VERIFIED';

    const result = evaluator.evaluate(gates);
    expect(result.overallStatus).toBe('NOT_VERIFIED');
    expect(result.allMandatoryPassed).toBe(false);
  });

  it('marks gate as BLOCKED if evidence age exceeds freshness validity window', () => {
    const customEvaluator = new ReadinessEvaluator({ maxEvidenceAgeSeconds: 3600 }); // 1 hour window
    const gates = DEFAULT_MANDATORY_GATES.map((id) => createPassingGate(id, `Gate ${id}`));

    // Set checkedAt to 2 hours in the past
    const twoHoursAgo = new Date(Date.now() - 7200 * 1000).toISOString();
    gates[0]!.checkedAt = twoHoursAgo;

    const result = customEvaluator.evaluate(gates);
    expect(result.overallStatus).toBe('BLOCKED');
    expect(result.gateResults[DEFAULT_MANDATORY_GATES[0]!]?.status).toBe('BLOCKED');
    expect(result.gateResults[DEFAULT_MANDATORY_GATES[0]!]?.reason).toContain('Stale evidence');
  });

  it('throws an error aborting evaluation if duplicate gate IDs are supplied', () => {
    const gates = [
      createPassingGate(DEFAULT_MANDATORY_GATES[0]!, 'First'),
      createPassingGate(DEFAULT_MANDATORY_GATES[0]!, 'Duplicate'),
    ];

    expect(() => evaluator.evaluate(gates)).toThrowError(/Duplicate gate identifier/);
  });

  it('calculates bounded exponential backoff delay with jitter accurately (Section 8.4)', () => {
    const delay0 = evaluator.calculateBackoffDelayMs(0, {
      baseDelayMs: 100,
      maxDelayMs: 10000,
      jitterMs: 0,
      randomFn: () => 0,
    });
    expect(delay0).toBe(100);

    const delay3 = evaluator.calculateBackoffDelayMs(3, {
      baseDelayMs: 100,
      maxDelayMs: 10000,
      jitterMs: 0,
      randomFn: () => 0,
    });
    expect(delay3).toBe(800); // 100 * 2^3 = 800

    // Test maxDelayMs clamping
    const delayClamped = evaluator.calculateBackoffDelayMs(20, {
      baseDelayMs: 100,
      maxDelayMs: 5000,
      jitterMs: 50,
      randomFn: () => 1,
    });
    expect(delayClamped).toBe(5000);
  });
});
