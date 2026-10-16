import type {
  GateStatus,
  OperationalGateResult,
  ReadinessEvaluationResult,
  ReleaseGateDefinition,
  ReleaseGateRecord,
} from './gate-types.js';

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

export const PHASE_6_RELEASE_GATE_DEFINITIONS: ReleaseGateDefinition[] = [
  {
    id: 'GATE_A_DATABASE_FINANCIAL_RESILIENCE',
    title: 'Database Schema, Migrations & Financial Resilience',
    scope: 'local',
    requiredEvidence: [
      'Sequential migration history (0001-0008)',
      'Double-entry accounting invariant: sum(debits) == sum(credits)',
      'Integer minor units (paise) representation',
      'Cumulative partial-refund fee reversal telescoping formula',
    ],
    responsibleOwner: 'Database Reliability Lead & Financial Systems Lead',
  },
  {
    id: 'GATE_B_MONITORING_ALERTING',
    title: 'Observability Telemetry & Staging Alert Delivery',
    scope: 'staging_cloud',
    requiredEvidence: [
      'Fastify health (/health) and readiness (/ready) probe verification',
      'Synthetic non-destructive alert dispatch (SyntheticAlertRoutingCheck)',
      'Receipt confirmation in staging PagerDuty service within SLA <= 60s',
      'Receipt confirmation in staging Slack #cc-staging-alerts channel',
    ],
    responsibleOwner: 'SRE / Observability Lead',
    blockingPrerequisites: [
      'Staging Alertmanager webhook routing and PagerDuty/Slack service keys',
    ],
    remediation: 'Authorize and execute synthetic alert drill against staging Alertmanager.',
  },
  {
    id: 'GATE_C_MANAGED_SECRETS_CLOUD_KMS',
    title: 'Runtime Managed Secrets Injection & Cloud KMS Isolation',
    scope: 'staging_cloud',
    requiredEvidence: [
      'AWS Secrets Manager / Doppler staging secret bundle (creatorconnect/staging/app)',
      'Zero static .env files in container filesystem or source control',
      'IAM role creatorconnect-staging-api-role least privilege attachment',
    ],
    responsibleOwner: 'DevSecOps Lead',
    blockingPrerequisites: ['AWS KMS key and IAM task role provisioning'],
    remediation:
      'Provision staging IAM role and populate staging secret bundle in AWS Secrets Manager.',
  },
  {
    id: 'GATE_D_LEGAL_BANKING_COMPLIANCE',
    title: 'Legal, Banking & RBI Escrow Regulatory Compliance',
    scope: 'stakeholder_approval',
    requiredEvidence: [
      'Legal counsel formal written sign-off under RBI PA/PG Guidelines',
      'Scheduled commercial partner bank tripartite nodal/escrow merchant sign-off',
      'Chief Financial Officer formal fee schedule and dispute reserve sign-off',
    ],
    responsibleOwner: 'Corporate Counsel, Head of Merchant Acquiring, CFO',
    blockingPrerequisites: ['Formal written approvals from Legal, Banking Partner, and CFO'],
    remediation: 'Execute written sign-offs with authorized corporate signatories.',
  },
  {
    id: 'GATE_E_DEPENDENCY_SECURITY',
    title: 'Supply-Chain Dependency Vulnerability Audit',
    scope: 'ci',
    requiredEvidence: [
      'Clean production dependency audit: pnpm audit --prod reporting 0 vulnerabilities',
      'Accountable risk acceptance register for dev-only tooling vulnerabilities',
    ],
    responsibleOwner: 'DevSecOps Lead',
  },
  {
    id: 'GATE_F_LOCAL_ENGINEERING_QUALITY',
    title: 'Local Engineering Quality & Automated Test Suites',
    scope: 'local',
    requiredEvidence: [
      'Zero lint warnings/errors across all 13 workspace packages',
      'Zero TypeScript compiler errors across all workspace packages',
      '100% Prettier formatting compliance',
      'All unit test suites passing (624/624 tests)',
      'All E2E browser tests passing (23/23 tests)',
    ],
    responsibleOwner: 'Principal Software Architect & QA Lead',
  },
  {
    id: 'GATE_G_REMOTE_CI',
    title: 'Remote GitHub Actions CI Workflow Validation',
    scope: 'ci',
    requiredEvidence: [
      'PR Validation & Quality Gates workflow green on candidate SHA',
      'CodeQL Security Analysis workflow green (0 alerts) on candidate SHA',
    ],
    responsibleOwner: 'DevSecOps Lead',
  },
  {
    id: 'GATE_H_CLOUD_PITR_DISASTER_RECOVERY',
    title: 'Cloud Point-In-Time Recovery (PITR) & Continuous WAL Streaming',
    scope: 'staging_cloud',
    requiredEvidence: [
      'Empirical staging Aurora PostgreSQL continuous WAL recovery drill',
      'Measured RPO <= 5.0s evaluated via recovery-point age and sequence gap',
      'Measured RTO <= 900.0s (incident start to verified read/write restoration)',
      'Post-restore double-entry ledger balance verification (difference == 0 paise)',
    ],
    responsibleOwner: 'Database Reliability Lead',
    blockingPrerequisites: ['Staging AWS Aurora Multi-AZ cluster with continuous WAL archiving'],
    remediation: 'Execute empirical cloud canary-based PITR drill on staging Aurora cluster.',
  },
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

  /**
   * Evaluates Phase 6 Release Gates (A through H) with strict evidence enforcement (Section 13).
   *
   * Non-negotiable release gate rules:
   * 1. A gate evaluator must not infer PASS from the absence of an error or missing evidence.
   * 2. Local technical checks cannot close cloud-only gates (Gate B, Gate C, Gate H).
   * 3. Technical checks cannot close stakeholder approval gates (Gate D).
   * 4. Production deployment is strictly NO-GO unless all Gates A-H are PASS or ACCEPTED_RISK.
   * 5. Live financial transactions remain strictly PROHIBITED.
   */
  public evaluateReleaseGates(
    definitions: ReleaseGateDefinition[] = PHASE_6_RELEASE_GATE_DEFINITIONS,
    records: ReleaseGateRecord[],
    now: Date = new Date(),
  ): {
    overallStatus: GateStatus;
    gateRecords: Record<string, ReleaseGateRecord>;
    canDeployStaging: boolean;
    canDeployProduction: boolean;
    liveFinancialTransactionsAllowed: boolean;
    summary: string;
  } {
    const recordMap: Record<string, ReleaseGateRecord> = {};
    for (const rec of records) {
      if (recordMap[rec.id]) {
        throw new Error(`Duplicate release gate record encountered: '${rec.id}'.`);
      }
      recordMap[rec.id] = rec;
    }

    const evaluatedGates: Record<string, ReleaseGateRecord> = {};
    let hasFail = false;
    let hasBlocked = false;
    let hasNotVerified = false;
    const blockingReasons: string[] = [];

    for (const def of definitions) {
      const existing = recordMap[def.id];

      if (!existing) {
        hasBlocked = true;
        evaluatedGates[def.id] = {
          id: def.id,
          title: def.title,
          status: 'BLOCKED',
          scope: def.scope,
          requiredEvidence: def.requiredEvidence,
          actualEvidence: [],
          checkedAt: now.toISOString(),
          verifier: 'ReadinessEvaluator',
          responsibleOwner: def.responsibleOwner,
          blockingPrerequisites: def.blockingPrerequisites,
          remediation: def.remediation ?? 'Provide verified gate evidence.',
          reason: `Gate record missing for '${def.id}'.`,
        };
        blockingReasons.push(`Gate '${def.id}' is missing.`);
        continue;
      }

      // Check evidence completeness: missing required evidence prevents PASS
      const missingEvidence = def.requiredEvidence.filter(
        (req) =>
          !existing.actualEvidence.some((ev) => ev.toLowerCase().includes(req.toLowerCase())),
      );

      let effectiveStatus = existing.status;
      let effectiveReason = existing.reason;

      // Rule: cannot infer PASS if required evidence is missing
      if (effectiveStatus === 'PASS' && missingEvidence.length > 0) {
        effectiveStatus = 'NOT_VERIFIED';
        effectiveReason = `Evidence incomplete: missing [${missingEvidence.join(', ')}].`;
      }

      // Rule: local technical check cannot close cloud or stakeholder gates
      if (
        effectiveStatus === 'PASS' &&
        (def.scope === 'staging_cloud' || def.scope === 'stakeholder_approval') &&
        existing.scope === 'local'
      ) {
        effectiveStatus = def.scope === 'stakeholder_approval' ? 'BLOCKED' : 'NOT_VERIFIED';
        effectiveReason = `Scope violation: local evidence cannot satisfy '${def.scope}' gate requirements.`;
      }

      evaluatedGates[def.id] = {
        ...existing,
        status: effectiveStatus,
        reason: effectiveReason,
      };

      if (effectiveStatus === 'FAIL') {
        hasFail = true;
        blockingReasons.push(`Gate '${def.id}' reported FAIL: ${effectiveReason ?? 'unspecified'}`);
      } else if (effectiveStatus === 'BLOCKED') {
        hasBlocked = true;
        blockingReasons.push(`Gate '${def.id}' is BLOCKED: ${effectiveReason ?? 'unspecified'}`);
      } else if (effectiveStatus === 'NOT_VERIFIED') {
        hasNotVerified = true;
        blockingReasons.push(
          `Gate '${def.id}' is NOT_VERIFIED: ${effectiveReason ?? 'unspecified'}`,
        );
      }
    }

    let overallStatus: GateStatus = 'PASS';
    if (hasFail) {
      overallStatus = 'FAIL';
    } else if (hasBlocked) {
      overallStatus = 'BLOCKED';
    } else if (hasNotVerified) {
      overallStatus = 'NOT_VERIFIED';
    }

    // Staging readiness requires Gate A, Gate E, Gate F, Gate G passed
    const gateA = evaluatedGates['GATE_A_DATABASE_FINANCIAL_RESILIENCE']?.status;
    const gateE = evaluatedGates['GATE_E_DEPENDENCY_SECURITY']?.status;
    const gateF = evaluatedGates['GATE_F_LOCAL_ENGINEERING_QUALITY']?.status;
    const gateG = evaluatedGates['GATE_G_REMOTE_CI']?.status;

    const localAndCiGreen =
      (gateA === 'PASS' || gateA === 'ACCEPTED_RISK') &&
      (gateE === 'PASS' || gateE === 'ACCEPTED_RISK') &&
      (gateF === 'PASS' || gateF === 'ACCEPTED_RISK') &&
      (gateG === 'PASS' || gateG === 'ACCEPTED_RISK');

    // Staging is CONDITIONAL GO if local/CI are green, but cloud deployment itself depends on cloud provisioning
    const canDeployStaging = localAndCiGreen && !hasFail;

    // Production is STRICTLY PROHIBITED unless all gates pass without exceptions
    const canDeployProduction = overallStatus === 'PASS';

    // Live financial transactions are STRICTLY PROHIBITED
    const liveFinancialTransactionsAllowed = false;

    let summary = 'All release gates verified successfully.';
    if (hasFail) {
      summary = `Release evaluation FAILED: ${blockingReasons.join('; ')}`;
    } else if (hasBlocked) {
      summary = `Release evaluation BLOCKED: ${blockingReasons.join('; ')}`;
    } else if (hasNotVerified) {
      summary = `Release evaluation NOT_VERIFIED: ${blockingReasons.join('; ')}`;
    }

    return {
      overallStatus,
      gateRecords: evaluatedGates,
      canDeployStaging,
      canDeployProduction,
      liveFinancialTransactionsAllowed,
      summary,
    };
  }
}
