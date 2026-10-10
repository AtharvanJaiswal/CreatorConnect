import { describe, it, expect } from 'vitest';
import { DatabaseRestoreDrillRunner } from './database-restore-drill.js';

describe('DatabaseRestoreDrillRunner Integration', () => {
  it('should successfully execute an isolated database restore drill and verify schema integrity', async () => {
    const runner = new DatabaseRestoreDrillRunner({
      containerName: 'creatorconnect-postgres',
      sourceDb: 'creatorconnect_dev',
      drillDb: 'creatorconnect_restore_drill',
      backupPath: '/tmp/creatorconnect_restore_drill.dump',
    });

    const report = await runner.runDrill();

    expect(report.gateResult.status).toBe('PASS');
    expect(report.gateResult.id).toBe('GATE_A_BACKUP_RESTORE');
    expect(report.backupMetadata.sha256Digest).toBeDefined();
    expect(report.backupMetadata.sizeBytes).toBeGreaterThan(0);

    // Verify metrics
    expect(report.drillMetrics.tablesVerified).toBe(32);
    expect(report.drillMetrics.indexesVerified).toBeGreaterThan(50);
    expect(report.drillMetrics.foreignKeysVerified).toBeGreaterThan(20);
    expect(report.drillMetrics.migrationsVerified).toBe(4);

    // Verify recovery objectives
    expect(report.drillMetrics.rtoSeconds).toBeLessThan(900); // Well under 15m SLA
    expect(report.drillMetrics.rpoSeconds).toBeLessThan(5); // Well under 5s SLA
    expect(report.restoreResult.status).toBe('PASS');
  }, 30000); // 30s timeout for live dump and restore
});
