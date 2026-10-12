import { createHash } from 'node:crypto';
import type {
  BackupMetadata,
  BackupIntegrityResult,
  RestoreExpectations,
  RestoreVerificationResult,
  OperationalGateResult,
} from './gate-types.js';

export const EXPECTED_PHASE_5_TABLES = [
  '_prisma_migrations',
  'application_status_history',
  'applications',
  'assignment_requirements',
  'assignments',
  'audit_logs',
  'brand_profiles',
  'categories',
  'conversation_participants',
  'conversations',
  'creator_profile_categories',
  'creator_profiles',
  'media_assets',
  'message_attachments',
  'message_reactions',
  'messages',
  'moderation_actions',
  'notification_preferences',
  'notifications',
  'outbox_events',
  'podcaster_profiles',
  'portfolio_items',
  'portfolio_media',
  'processed_events',
  'professional_profiles',
  'reports',
  'roles',
  'skills',
  'user_blocks',
  'user_roles',
  'user_skills',
  'users',
];

export const EXPECTED_CRITICAL_INDEXES = [
  'notifications_user_id_created_at_id_idx',
  'notifications_event_id_idx',
  'idx_assignments_search',
  'idx_creator_profiles_search',
  'users_email_key',
  'users_supabase_auth_id_key',
];

export const EXPECTED_CRITICAL_CONSTRAINTS = [
  'chk_assignments_budget_nonneg',
  'chk_assignments_budget_range',
  'user_roles_user_id_fkey',
  'messages_conversation_id_fkey',
];

export class BackupVerifier {
  /**
   * Computes SHA-256 cryptographic digest of a binary or string buffer:
   * H(B_source) = H(B_verified)
   */
  public computeSha256(data: Buffer | string): string {
    const hash = createHash('sha256');
    hash.update(data);
    return hash.digest('hex');
  }

  /**
   * Verifies backup integrity against expected cryptographic digest and recovery window policy.
   */
  public verifyIntegrity(
    metadata: BackupMetadata,
    actualDataOrDigest: Buffer | string,
    now: Date = new Date(),
  ): BackupIntegrityResult {
    const actualDigest =
      typeof actualDataOrDigest === 'string' && /^[a-f0-9]{64}$/i.test(actualDataOrDigest)
        ? actualDataOrDigest
        : this.computeSha256(actualDataOrDigest);
    const digestMatched = actualDigest.toLowerCase() === metadata.sha256Digest.toLowerCase();

    const createdTime = new Date(metadata.createdAt).getTime();
    const ageSeconds = Math.max(0, (now.getTime() - createdTime) / 1000);
    const maxWindowSeconds = (metadata.recoveryWindowMaxHours ?? 24) * 3600;
    const isWithinRecoveryWindow = ageSeconds <= maxWindowSeconds;

    if (!digestMatched) {
      return {
        status: 'FAIL',
        backupId: metadata.backupId,
        digestMatched: false,
        expectedDigest: metadata.sha256Digest,
        actualDigest,
        isWithinRecoveryWindow,
        ageSeconds,
        reason: 'Cryptographic digest mismatch: backup artifact may be corrupted or altered.',
      };
    }

    if (!isWithinRecoveryWindow) {
      return {
        status: 'FAIL',
        backupId: metadata.backupId,
        digestMatched: true,
        expectedDigest: metadata.sha256Digest,
        actualDigest,
        isWithinRecoveryWindow: false,
        ageSeconds,
        reason: `Backup exceeds maximum retention recovery window (${ageSeconds}s > ${maxWindowSeconds}s).`,
      };
    }

    if (metadata.sizeBytes <= 0) {
      return {
        status: 'FAIL',
        backupId: metadata.backupId,
        digestMatched: true,
        expectedDigest: metadata.sha256Digest,
        actualDigest,
        isWithinRecoveryWindow: true,
        ageSeconds,
        reason: 'Backup artifact is empty (0 bytes).',
      };
    }

    return {
      status: 'PASS',
      backupId: metadata.backupId,
      digestMatched: true,
      expectedDigest: metadata.sha256Digest,
      actualDigest,
      isWithinRecoveryWindow: true,
      ageSeconds,
    };
  }
}

export class RestoreVerifier {
  /**
   * Verifies that a restored database satisfies schema, relational, and RPO/RTO invariants.
   */
  public verifyRestoredDatabase(params: {
    targetDatabase: string;
    actualTables: string[];
    actualIndexes: string[];
    actualConstraints?: string[];
    failureTimestamp: string;
    latestRecoverableTimestamp: string;
    recoveryStartedTimestamp: string;
    serviceRestoredTimestamp: string;
    expectations?: Partial<RestoreExpectations>;
    environment?: 'local' | 'test' | 'staging' | 'production';
  }): RestoreVerificationResult {
    const expectations: RestoreExpectations = {
      expectedTables: params.expectations?.expectedTables ?? EXPECTED_PHASE_5_TABLES,
      expectedIndexes: params.expectations?.expectedIndexes ?? EXPECTED_CRITICAL_INDEXES,
      expectedConstraints:
        params.expectations?.expectedConstraints ?? EXPECTED_CRITICAL_CONSTRAINTS,
      maxRpoSeconds: params.expectations?.maxRpoSeconds ?? 5, // PostgreSQL SLA: RPO < 5 seconds
      maxRtoSeconds: params.expectations?.maxRtoSeconds ?? 900, // PostgreSQL SLA: RTO < 15 minutes (900s)
    };

    const actualTableSet = new Set(params.actualTables.map((t) => t.toLowerCase()));
    const missingTables = expectations.expectedTables.filter(
      (t) => !actualTableSet.has(t.toLowerCase()),
    );

    const actualIndexSet = new Set(params.actualIndexes.map((i) => i.toLowerCase()));
    const missingIndexes = expectations.expectedIndexes.filter(
      (i) => !actualIndexSet.has(i.toLowerCase()),
    );

    const actualConstraintSet = new Set(
      (params.actualConstraints ?? []).map((c) => c.toLowerCase()),
    );
    const missingConstraints = expectations.expectedConstraints.filter(
      (c) => !actualConstraintSet.has(c.toLowerCase()),
    );

    // Calculate RPO: t_failure - t_latest_recoverable
    const tFailure = new Date(params.failureTimestamp).getTime();
    const tLatest = new Date(params.latestRecoverableTimestamp).getTime();
    const measuredRpoSeconds = Math.max(0, (tFailure - tLatest) / 1000);
    const rpoPassed = measuredRpoSeconds <= expectations.maxRpoSeconds;

    // Calculate RTO: t_service_restored - t_recovery_started
    const tStarted = new Date(params.recoveryStartedTimestamp).getTime();
    const tRestored = new Date(params.serviceRestoredTimestamp).getTime();
    const measuredRtoSeconds = Math.max(0, (tRestored - tStarted) / 1000);
    const rtoPassed = measuredRtoSeconds <= expectations.maxRtoSeconds;

    const invariantsPassed =
      missingTables.length === 0 &&
      missingIndexes.length === 0 &&
      missingConstraints.length === 0 &&
      rpoPassed &&
      rtoPassed;

    const evidence = [
      `Target database: ${params.targetDatabase}`,
      `Verified tables: ${params.actualTables.length} found, ${missingTables.length} missing`,
      `Verified indexes: ${params.actualIndexes.length} found, ${missingIndexes.length} missing`,
      `Measured RPO: ${measuredRpoSeconds}s (Threshold: <= ${expectations.maxRpoSeconds}s) -> ${rpoPassed ? 'PASS' : 'FAIL'}`,
      `Measured RTO: ${measuredRtoSeconds}s (Threshold: <= ${expectations.maxRtoSeconds}s) -> ${rtoPassed ? 'PASS' : 'FAIL'}`,
    ];

    let reason: string | undefined;
    if (!invariantsPassed) {
      const issues: string[] = [];
      if (missingTables.length > 0) issues.push(`Missing tables: [${missingTables.join(', ')}]`);
      if (missingIndexes.length > 0) issues.push(`Missing indexes: [${missingIndexes.join(', ')}]`);
      if (missingConstraints.length > 0)
        issues.push(`Missing constraints: [${missingConstraints.join(', ')}]`);
      if (!rpoPassed)
        issues.push(`RPO exceeded: ${measuredRpoSeconds}s > ${expectations.maxRpoSeconds}s`);
      if (!rtoPassed)
        issues.push(`RTO exceeded: ${measuredRtoSeconds}s > ${expectations.maxRtoSeconds}s`);
      reason = issues.join('; ');
    }

    return {
      status: invariantsPassed ? 'PASS' : 'FAIL',
      targetDatabase: params.targetDatabase,
      missingTables,
      missingIndexes,
      missingConstraints,
      measuredRpoSeconds,
      measuredRtoSeconds,
      rpoPassed,
      rtoPassed,
      invariantsPassed,
      evidence,
      reason,
    };
  }

  /**
   * Adapts RestoreVerificationResult into a standard OperationalGateResult.
   */
  public toGateResult(
    result: RestoreVerificationResult,
    environment: 'local' | 'test' | 'staging' | 'production' = 'test',
  ): OperationalGateResult {
    return {
      id: 'GATE_A_BACKUP_RESTORE',
      name: 'Database Backup Integrity & Restore Drill Gate',
      status: result.status,
      environment,
      evidence: result.evidence,
      checkedAt: new Date().toISOString(),
      reason: result.reason,
    };
  }
}
