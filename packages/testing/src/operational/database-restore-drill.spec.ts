import { describe, it, expect } from 'vitest';
import { DatabaseRestoreDrillRunner } from './database-restore-drill.js';

describe('DatabaseRestoreDrillRunner Integration', () => {
  it('should successfully execute an isolated database restore drill and verify schema integrity using auto-discovered postgres container', async () => {
    // containerName omitted to test dynamic container discovery in current environment
    const runner = new DatabaseRestoreDrillRunner({
      sourceDb: 'creatorconnect_dev',
      drillDb: 'creatorconnect_restore_drill',
      backupPath: '/tmp/creatorconnect_restore_drill.dump',
    });

    const report = await runner.runDrill();

    expect(report.gateResult.status).toBe('PASS');
    expect(report.gateResult.id).toBe('GATE_A_BACKUP_RESTORE');
    expect(report.backupMetadata.sha256Digest).toBeDefined();
    expect(report.backupMetadata.sizeBytes).toBeGreaterThan(0);

    // Verify schema metrics (Phase 5 baseline: >= 32 tables, >= 4 migrations)
    expect(report.drillMetrics.tablesVerified).toBeGreaterThanOrEqual(32);
    expect(report.drillMetrics.indexesVerified).toBeGreaterThan(50);
    expect(report.drillMetrics.foreignKeysVerified).toBeGreaterThan(20);
    expect(report.drillMetrics.migrationsVerified).toBeGreaterThanOrEqual(4);

    // Verify recovery objectives
    expect(report.drillMetrics.rtoSeconds).toBeLessThan(900); // Well under 15m SLA
    expect(report.drillMetrics.rpoSeconds).toBeLessThan(5); // Well under 5s SLA
    expect(report.restoreResult.status).toBe('PASS');

    // Verify container resolution succeeded
    const resolved = runner.getResolvedContainer();
    expect(resolved).not.toBeNull();
    expect(resolved?.id).toBeDefined();
  }, 45000); // 45s timeout for live dump and restore

  it('should enforce test isolation and reject drillDb identical to sourceDb', async () => {
    const runner = new DatabaseRestoreDrillRunner({
      sourceDb: 'creatorconnect_dev',
      drillDb: 'creatorconnect_dev', // Attempting to use same database
    });

    await expect(runner.runDrill()).rejects.toThrow(
      /Test isolation violation: drillDb .* cannot be identical to sourceDb/,
    );
  });

  it('should enforce test isolation and reject targeting a protected primary database', async () => {
    const runner = new DatabaseRestoreDrillRunner({
      sourceDb: 'creatorconnect_custom',
      drillDb: 'creatorconnect_dev', // Protected database
    });

    await expect(runner.runDrill()).rejects.toThrow(
      /Test isolation violation: drillDb cannot target protected database "creatorconnect_dev"/,
    );
  });

  it('should successfully resolve running container when preferredName is provided', () => {
    const runner = new DatabaseRestoreDrillRunner({
      containerName: 'creatorconnect-postgres',
      sourceDb: 'creatorconnect_dev',
      drillDb: 'creatorconnect_restore_drill_sub',
    });

    const container = runner.resolveContainer();
    expect(container.id).toBeDefined();
  });
});
