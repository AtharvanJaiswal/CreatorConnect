/**
 * CreatorConnect — Operational Readiness & Production Safety Gate Types
 * Strict typed contracts for operational verifiers and fail-closed gate orchestration.
 */

export type GateStatus = 'PASS' | 'FAIL' | 'BLOCKED' | 'NOT_VERIFIED';

export type OperationalEnvironment = 'local' | 'development' | 'test' | 'staging' | 'production';

export interface OperationalGateResult {
  id: string;
  name: string;
  status: GateStatus;
  environment: OperationalEnvironment;
  evidence: string[];
  checkedAt: string;
  reason?: string | undefined;
}

export interface BackupMetadata {
  backupId: string;
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
