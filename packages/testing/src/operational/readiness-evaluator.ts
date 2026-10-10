import type { GateStatus, OperationalGateResult, ReadinessEvaluationResult } from './gate-types.js';

export interface ReadinessEvaluatorOptions {
  mandatoryGateIds?: string[];
  maxEvidenceAgeSeconds?: number; // Evidence freshness validity window T_valid
}

export const DEFAULT_MANDATORY_GATES = [
  'GATE_A_BACKUP_RESTORE',
  'GATE_B_MONITORING_ALERTING',
  'GATE_C_PRODUCTION_CONFIGURATION',
  'GATE_D_APPLICATION_COMPATIBILITY',
];

export class ReadinessEvaluator {
  private readonly mandatoryGates: Set<string>;
  private readonly maxEvidenceAgeSeconds: number;

  constructor(options?: ReadinessEvaluatorOptions) {
    this.mandatoryGates = new Set(options?.mandatoryGateIds ?? DEFAULT_MANDATORY_GATES);
    this.maxEvidenceAgeSeconds = options?.maxEvidenceAgeSeconds ?? 86400; // 24 hours default freshness window
  }

  /**
   * Bounded exponential backoff with jitter calculation (Section 8.4):
   * d_k = min(d_max, d_0 * 2^k) + J_k
   */
  public calculateBackoffDelayMs(
    attempt: number,
    options?: {
      baseDelayMs?: number;
      maxDelayMs?: number;
      jitterMs?: number;
      randomFn?: () => number;
    },
  ): number {
    const d0 = Math.max(options?.baseDelayMs ?? 100, 10);
    const dMax = Math.max(options?.maxDelayMs ?? 10000, d0);
    const jitterMax = Math.max(options?.jitterMs ?? 50, 0);
    const random = options?.randomFn ?? Math.random;

    const normalizedAttempt = Math.max(0, Math.min(attempt, 30));
    const exponential = Math.min(dMax, d0 * Math.pow(2, normalizedAttempt));
    const jitter = jitterMax > 0 ? Math.floor(random() * jitterMax) : 0;

    return Math.min(dMax, exponential + jitter);
  }

  /**
   * Validates whether evidence timestamp is fresh within validity window T_valid (Section 8.3):
   * Fresh(e) = (t_now - t_checked) <= T_valid
   */
  public isEvidenceFresh(checkedAt: string, now: Date = new Date()): boolean {
    const checkedDate = new Date(checkedAt);
    if (isNaN(checkedDate.getTime())) {
      return false;
    }
    const ageSeconds = Math.max(0, (now.getTime() - checkedDate.getTime()) / 1000);
    return ageSeconds <= this.maxEvidenceAgeSeconds;
  }

  /**
   * Evaluates operational readiness using strict fail-closed logic (Section 8.2):
   * G_ready = AND(g_1 ... g_n)
   */
  public evaluate(
    results: OperationalGateResult[],
    now: Date = new Date(),
  ): ReadinessEvaluationResult {
    const gateMap: Record<string, OperationalGateResult> = {};
    const seenIds = new Set<string>();

    for (const r of results) {
      if (seenIds.has(r.id)) {
        throw new Error(
          `Duplicate gate identifier encountered: '${r.id}'. Gate evaluation aborted.`,
        );
      }
      seenIds.add(r.id);
      gateMap[r.id] = r;
    }

    // Check mandatory gates existence and freshness
    let hasFail = false;
    let hasBlocked = false;
    let hasNotVerified = false;
    let missingMandatory = false;
    const missingGateIds: string[] = [];

    for (const mandatoryId of this.mandatoryGates) {
      const gate = gateMap[mandatoryId];
      if (!gate) {
        missingMandatory = true;
        missingGateIds.push(mandatoryId);
        continue;
      }

      if (!this.isEvidenceFresh(gate.checkedAt, now)) {
        // Stale evidence transitions gate to BLOCKED
        gate.status = 'BLOCKED';
        gate.reason = `Stale evidence: evaluated evidence exceeds maximum freshness window of ${this.maxEvidenceAgeSeconds}s.`;
      }

      if (gate.status === 'FAIL') {
        hasFail = true;
      } else if (gate.status === 'BLOCKED') {
        hasBlocked = true;
      } else if (gate.status === 'NOT_VERIFIED') {
        hasNotVerified = true;
      }
    }

    let overallStatus: GateStatus = 'PASS';
    let summary = 'All mandatory production readiness gates verified successfully.';

    if (hasFail) {
      overallStatus = 'FAIL';
      summary = 'Readiness check failed: one or more mandatory gates reported explicit failures.';
    } else if (missingMandatory) {
      overallStatus = 'BLOCKED';
      summary = `Readiness check blocked: mandatory gates missing: [${missingGateIds.join(', ')}].`;
    } else if (hasBlocked) {
      overallStatus = 'BLOCKED';
      summary = 'Readiness check blocked: one or more mandatory gates are blocked or stale.';
    } else if (hasNotVerified) {
      overallStatus = 'NOT_VERIFIED';
      summary = 'Readiness check incomplete: one or more mandatory gates remain unverified.';
    }

    return {
      overallStatus,
      gateResults: gateMap,
      allMandatoryPassed: overallStatus === 'PASS',
      evaluatedAt: now.toISOString(),
      summary,
    };
  }
}
