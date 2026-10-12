import { describe, it, expect } from 'vitest';
import {
  BackupVerifier,
  RestoreVerifier,
  EXPECTED_PHASE_5_TABLES,
  EXPECTED_CRITICAL_INDEXES,
  EXPECTED_CRITICAL_CONSTRAINTS,
} from './backup-restore-verifier.js';
import type { BackupMetadata } from './gate-types.js';

describe('BackupVerifier & RestoreVerifier (Gate A)', () => {
  const backupVerifier = new BackupVerifier();
  const restoreVerifier = new RestoreVerifier();

  describe('BackupVerifier', () => {
    const rawBackupContent = 'CREATORCONNECT_DUMP_SAMPLE_CONTENT_WITH_WAL_ARCHIVE';
    const validDigest = backupVerifier.computeSha256(rawBackupContent);

    const validMetadata: BackupMetadata = {
      backupId: 'backup_20261010_001',
      targetDatabase: 'creatorconnect_prod',
      createdAt: new Date().toISOString(),
      sizeBytes: Buffer.byteLength(rawBackupContent),
      sha256Digest: validDigest,
      isEncrypted: true,
      recoveryWindowMaxHours: 24,
    };

    it('verifies integrity successfully when SHA-256 digest matches and within window', () => {
      const result = backupVerifier.verifyIntegrity(validMetadata, rawBackupContent);

      expect(result.status).toBe('PASS');
      expect(result.digestMatched).toBe(true);
      expect(result.isWithinRecoveryWindow).toBe(true);
      expect(result.actualDigest).toBe(validDigest);
    });

    it('fails integrity check when SHA-256 digest does not match (tampering / corruption)', () => {
      const corruptedContent = rawBackupContent + '_TAMPERED';
      const result = backupVerifier.verifyIntegrity(validMetadata, corruptedContent);

      expect(result.status).toBe('FAIL');
      expect(result.digestMatched).toBe(false);
      expect(result.reason).toContain('Cryptographic digest mismatch');
    });

    it('fails integrity check when backup age exceeds recovery window SLA', () => {
      const expiredMetadata: BackupMetadata = {
        ...validMetadata,
        createdAt: new Date(Date.now() - 48 * 3600 * 1000).toISOString(), // 48 hours ago
        recoveryWindowMaxHours: 24,
      };

      const result = backupVerifier.verifyIntegrity(expiredMetadata, rawBackupContent);
      expect(result.status).toBe('FAIL');
      expect(result.isWithinRecoveryWindow).toBe(false);
      expect(result.reason).toContain('exceeds maximum retention recovery window');
    });

    it('fails integrity check when backup size is zero bytes', () => {
      const emptyContent = '';
      const emptyDigest = backupVerifier.computeSha256(emptyContent);
      const emptyMetadata: BackupMetadata = {
        ...validMetadata,
        sizeBytes: 0,
        sha256Digest: emptyDigest,
      };

      const result = backupVerifier.verifyIntegrity(emptyMetadata, emptyContent);
      expect(result.status).toBe('FAIL');
      expect(result.reason).toContain('0 bytes');
    });
  });

  describe('RestoreVerifier', () => {
    it('verifies restored database when all tables, indexes, constraints, and RPO/RTO meet SLA', () => {
      const result = restoreVerifier.verifyRestoredDatabase({
        targetDatabase: 'creatorconnect_restore_test',
        actualTables: [...EXPECTED_PHASE_5_TABLES],
        actualIndexes: [...EXPECTED_CRITICAL_INDEXES],
        actualConstraints: [...EXPECTED_CRITICAL_CONSTRAINTS],
        failureTimestamp: '2026-10-10T12:00:05.000Z',
        latestRecoverableTimestamp: '2026-10-10T12:00:03.000Z', // RPO = 2s (SLA: <= 5s)
        recoveryStartedTimestamp: '2026-10-10T12:01:00.000Z',
        serviceRestoredTimestamp: '2026-10-10T12:05:30.000Z', // RTO = 270s (4.5 min, SLA: <= 900s)
      });

      expect(result.status).toBe('PASS');
      expect(result.invariantsPassed).toBe(true);
      expect(result.rpoPassed).toBe(true);
      expect(result.rtoPassed).toBe(true);
      expect(result.measuredRpoSeconds).toBe(2);
      expect(result.measuredRtoSeconds).toBe(270);
      expect(result.missingTables).toHaveLength(0);
      expect(result.missingIndexes).toHaveLength(0);
    });

    it('fails restore verification when expected tables or indexes are missing', () => {
      const result = restoreVerifier.verifyRestoredDatabase({
        targetDatabase: 'creatorconnect_restore_test',
        actualTables: ['users', 'roles'], // missing almost all tables
        actualIndexes: [],
        actualConstraints: [],
        failureTimestamp: '2026-10-10T12:00:05.000Z',
        latestRecoverableTimestamp: '2026-10-10T12:00:03.000Z',
        recoveryStartedTimestamp: '2026-10-10T12:01:00.000Z',
        serviceRestoredTimestamp: '2026-10-10T12:02:00.000Z',
      });

      expect(result.status).toBe('FAIL');
      expect(result.invariantsPassed).toBe(false);
      expect(result.missingTables.length).toBeGreaterThan(0);
      expect(result.missingIndexes.length).toBeGreaterThan(0);
      expect(result.reason).toContain('Missing tables');
    });

    it('fails restore verification when measured RPO exceeds SLA threshold (data loss)', () => {
      const result = restoreVerifier.verifyRestoredDatabase({
        targetDatabase: 'creatorconnect_restore_test',
        actualTables: [...EXPECTED_PHASE_5_TABLES],
        actualIndexes: [...EXPECTED_CRITICAL_INDEXES],
        actualConstraints: [...EXPECTED_CRITICAL_CONSTRAINTS],
        failureTimestamp: '2026-10-10T12:00:30.000Z',
        latestRecoverableTimestamp: '2026-10-10T12:00:00.000Z', // RPO = 30s > 5s
        recoveryStartedTimestamp: '2026-10-10T12:01:00.000Z',
        serviceRestoredTimestamp: '2026-10-10T12:03:00.000Z',
      });

      expect(result.status).toBe('FAIL');
      expect(result.rpoPassed).toBe(false);
      expect(result.reason).toContain('RPO exceeded');
    });

    it('fails restore verification when measured RTO exceeds SLA threshold (excessive downtime)', () => {
      const result = restoreVerifier.verifyRestoredDatabase({
        targetDatabase: 'creatorconnect_restore_test',
        actualTables: [...EXPECTED_PHASE_5_TABLES],
        actualIndexes: [...EXPECTED_CRITICAL_INDEXES],
        actualConstraints: [...EXPECTED_CRITICAL_CONSTRAINTS],
        failureTimestamp: '2026-10-10T12:00:02.000Z',
        latestRecoverableTimestamp: '2026-10-10T12:00:00.000Z',
        recoveryStartedTimestamp: '2026-10-10T12:00:00.000Z',
        serviceRestoredTimestamp: '2026-10-10T12:30:00.000Z', // RTO = 1800s (30m > 15m)
      });

      expect(result.status).toBe('FAIL');
      expect(result.rtoPassed).toBe(false);
      expect(result.reason).toContain('RTO exceeded');
    });
  });
});
