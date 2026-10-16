/**
 * CreatorConnect — Operational Readiness & Production Safety Gate Types
 * Strict typed contracts for operational verifiers and fail-closed gate orchestration.
 */

export type GateStatus = 'PASS' | 'FAIL' | 'BLOCKED' | 'NOT_VERIFIED' | 'ACCEPTED_RISK';

export type OperationalEnvironment = 'local' | 'development' | 'test' | 'staging' | 'production';

export type GateScope = 'local' | 'ci' | 'staging_cloud' | 'stakeholder_approval';

export interface EvidenceReference {
  readonly type: string;
  readonly description: string;
  readonly uriOrData?: string;
}

export interface RiskAcceptanceRecord {
  readonly owner: string;
  readonly rationale: string;
  readonly reviewDate: string;
  readonly scope: string;
  readonly advisoryIds?: string[];
}

export interface ReleaseGateDefinition {
  readonly id: string;
  readonly title: string;
  readonly scope: GateScope;
  readonly requiredEvidence: string[];
  readonly responsibleOwner: string;
  readonly blockingPrerequisites?: string[] | undefined;
  readonly expirySeconds?: number | undefined;
  readonly remediation?: string | undefined;
}

export interface ReleaseGateRecord {
  readonly id: string;
  readonly title: string;
  readonly status: GateStatus;
  readonly scope: GateScope;
  readonly requiredEvidence: string[];
  readonly actualEvidence: string[];
  readonly checkedAt: string;
  readonly verifier: string;
  readonly responsibleOwner: string;
  readonly blockingPrerequisites?: string[] | undefined;
  readonly remediation?: string | undefined;
  readonly reason?: string | undefined;
  readonly riskAcceptance?: RiskAcceptanceRecord | undefined;
}

export interface OperationalGateResult {
  id: string;
  name: string;
  status: GateStatus;
  environment: OperationalEnvironment;
  evidence: string[];
  checkedAt: string;
  reason?: string | undefined;
  scope?: GateScope | undefined;
  responsibleOwner?: string | undefined;
  riskAcceptance?: RiskAcceptanceRecord | undefined;
}

export interface ReadinessContext {
  readonly environment: OperationalEnvironment;
  readonly envVars?: Record<string, string | undefined>;
  readonly timeoutMs?: number;
  readonly executeNetworkProbes?: boolean;
}

export interface ReadinessCheckResult {
  readonly id: string;
  readonly title: string;
  readonly category: string;
  readonly scope: 'local' | 'cloud';
  readonly status: GateStatus;
  readonly evidence: EvidenceReference[];
  readonly remediation?: string | undefined;
  readonly reason?: string | undefined;
  readonly checkedAt: string;
}

export interface ReadinessCheck {
  readonly id: string;
  readonly title: string;
  readonly category: string;
  readonly scope: 'local' | 'cloud';
  run(context: ReadinessContext): Promise<ReadinessCheckResult>;
}

export interface StagingPreflightReport {
  readonly overallStatus: GateStatus;
  readonly environment: OperationalEnvironment;
  readonly totalChecks: number;
  readonly passedChecks: number;
  readonly blockedChecks: number;
  readonly failedChecks: number;
  readonly notVerifiedChecks: number;
  readonly results: ReadinessCheckResult[];
  readonly evaluatedAt: string;
  readonly summary: string;
  readonly stagingActivationAllowed: boolean;
}

export interface BackupMetadata {
  backupId: string;
  targetDatabase?: string;
  databaseName?: string;
  storagePath?: string;
  completedAt?: string;
  encryptionVerified?: boolean;
  immutable?: boolean;
  createdAt: string;
  sizeBytes: number;
  sha256Digest: string;
  isEncrypted?: boolean;
  recoveryWindowMaxHours?: number;
}

export interface BackupIntegrityResult {
  status: GateStatus;
  backupId: string;
  digestMatched: boolean;
  expectedDigest: string;
  actualDigest: string;
  isWithinRecoveryWindow: boolean;
  ageSeconds: number;
  reason?: string | undefined;
}

export interface RestoreExpectations {
  expectedTables: string[];
  expectedIndexes: string[];
  expectedConstraints: string[];
  maxRtoSeconds: number; // Recovery Time Objective SLA threshold
  maxRpoSeconds: number; // Recovery Point Objective SLA threshold
}

export interface RestoreVerificationResult {
  status: GateStatus;
  targetDatabase: string;
  missingTables: string[];
  missingIndexes: string[];
  missingConstraints: string[];
  measuredRpoSeconds: number;
  measuredRtoSeconds: number;
  rpoPassed: boolean;
  rtoPassed: boolean;
  invariantsPassed: boolean;
  evidence: string[];
  reason?: string | undefined;
}

export interface TelemetryCheckResult {
  status: GateStatus;
  service: string;
  endpoint: string;
  accessible: boolean;
  metricsPresent: string[];
  missingMetrics: string[];
  reason?: string | undefined;
}

export interface AlertDeliveryResult {
  status: GateStatus;
  alertType: 'P1' | 'P2' | 'P3';
  channel: string;
  sentCount: number;
  receivedCount: number;
  deliveryRatePercent: number;
  latencyMs: number;
  reason?: string | undefined;
}

export type ConfigurationStatus = 'PASS' | 'FAIL' | 'BLOCKED' | 'NOT_VERIFIED';

export interface ConfigurationCheck {
  key: string;
  status: ConfigurationStatus;
  environment: OperationalEnvironment;
  isSecret: boolean;
  sanitizedFormat: string;
  reason?: string | undefined;
  checkedAt: string;
}

export interface ConfigurationVerificationResult {
  status: GateStatus;
  environment: OperationalEnvironment;
  checks: ConfigurationCheck[];
  totalChecked: number;
  passedCount: number;
  failedCount: number;
  blockedCount: number;
  evidence: string[];
}

export interface ReadinessEvaluationResult {
  overallStatus: GateStatus;
  gateResults: Record<string, OperationalGateResult>;
  allMandatoryPassed: boolean;
  evaluatedAt: string;
  summary: string;
}
