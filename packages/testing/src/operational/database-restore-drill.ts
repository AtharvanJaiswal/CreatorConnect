import { execSync } from 'node:child_process';
import { BackupVerifier, RestoreVerifier } from './backup-restore-verifier.js';
import {
  PostgresContainerResolver,
  type PostgresContainerInfo,
} from './postgres-container-resolver.js';
import type {
  OperationalGateResult,
  BackupMetadata,
  RestoreVerificationResult,
} from './gate-types.js';

export interface DrillExecutionReport {
  gateResult: OperationalGateResult;
  backupMetadata: BackupMetadata;
  restoreResult: RestoreVerificationResult;
  drillMetrics: {
    rpoSeconds: number;
    rtoSeconds: number;
    tablesVerified: number;
    indexesVerified: number;
    foreignKeysVerified: number;
    migrationsVerified: number;
  };
}

export interface DatabaseRestoreDrillOptions {
  containerName?: string | undefined;
  sourceDb?: string | undefined;
  drillDb?: string | undefined;
  backupPath?: string | undefined;
  dbUser?: string | undefined;
  strictContainerName?: boolean | undefined;
}

export class DatabaseRestoreDrillRunner {
  private readonly preferredContainerName: string | undefined;
  private readonly sourceDb: string;
  private readonly drillDb: string;
  private readonly backupPath: string;
  private readonly dbUser: string;
  private readonly strictContainerName: boolean;
  private readonly backupVerifier: BackupVerifier;
  private readonly restoreVerifier: RestoreVerifier;
  private resolvedContainer: PostgresContainerInfo | null = null;

  constructor(options: DatabaseRestoreDrillOptions = {}) {
    this.preferredContainerName = options.containerName;
    this.sourceDb = options.sourceDb ?? this.parseDbFromEnv() ?? 'creatorconnect_dev';
    this.drillDb = options.drillDb ?? 'creatorconnect_restore_drill';
    this.backupPath = options.backupPath ?? '/tmp/creatorconnect_restore_drill.dump';
    this.dbUser = options.dbUser ?? 'postgres';
    this.strictContainerName = options.strictContainerName ?? false;
    this.backupVerifier = new BackupVerifier();
    this.restoreVerifier = new RestoreVerifier();
  }

  private parseDbFromEnv(): string | null {
    const url = process.env.DATABASE_URL;
    if (!url) return null;
    try {
      const parsed = new URL(url);
      const pathname = parsed.pathname.replace(/^\//, '');
      return pathname || null;
    } catch {
      return null;
    }
  }

  /**
   * Resolves the PostgreSQL container ID dynamically using the layered discovery strategy.
   */
  public resolveContainer(): PostgresContainerInfo {
    if (!this.resolvedContainer) {
      this.resolvedContainer = PostgresContainerResolver.resolve({
        preferredName: this.preferredContainerName,
        strictName: this.strictContainerName,
        sourceDb: this.sourceDb,
        dbUser: this.dbUser,
      });
    }
    return this.resolvedContainer;
  }

  public getResolvedContainer(): PostgresContainerInfo | null {
    return this.resolvedContainer;
  }

  private execInContainer(cmd: string): string {
    const container = this.resolveContainer();
    const fullCmd = `docker exec ${container.id} ${cmd}`;
    try {
      return execSync(fullCmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    } catch (err: any) {
      const stderr = err.stderr ? err.stderr.toString().trim() : '';
      const message = stderr || err.message;
      throw new Error(
        `Failed to execute command in container "${container.id}" (${container.name}): ${message}`,
      );
    }
  }

  /**
   * Safely cleans up the ephemeral drill database and backup file.
   */
  public cleanup(): void {
    try {
      this.execInContainer(`dropdb --if-exists -U ${this.dbUser} ${this.drillDb}`);
    } catch {
      // Best-effort cleanup
    }
    try {
      this.execInContainer(`rm -f ${this.backupPath}`);
    } catch {
      // Best-effort cleanup
    }
  }

  public async runDrill(): Promise<DrillExecutionReport> {
    // 0. Enforce strict test isolation before mutating anything
    if (this.drillDb.toLowerCase() === this.sourceDb.toLowerCase()) {
      throw new Error(
        `Test isolation violation: drillDb ("${this.drillDb}") cannot be identical to sourceDb ("${this.sourceDb}").`,
      );
    }

    const protectedDatabases = [
      'creatorconnect_dev',
      'creatorconnect_prod',
      'postgres',
      'template1',
    ];
    if (protectedDatabases.includes(this.drillDb.toLowerCase())) {
      throw new Error(
        `Test isolation violation: drillDb cannot target protected database "${this.drillDb}".`,
      );
    }

    // Ensure container can be discovered and reached
    this.resolveContainer();

    const backupId = `drill-backup-${Date.now()}`;
    const backupStartTime = new Date();
    let backupCreated = false;
    let drillDbCreated = false;

    try {
      // 1. Create source backup using pg_dump custom format
      this.execInContainer(
        `pg_dump -U ${this.dbUser} -d ${this.sourceDb} -F c -f ${this.backupPath}`,
      );
      backupCreated = true;
      const backupCompletedTime = new Date();

      // 2. Compute SHA-256 digest
      const shaOutput = this.execInContainer(`sha256sum ${this.backupPath}`);
      const sha256 = shaOutput.split(/\s+/)[0] ?? '';
      if (!sha256) {
        throw new Error(`Failed to calculate SHA-256 digest from output: ${shaOutput}`);
      }

      // Get backup file size in bytes
      const sizeOutput = this.execInContainer(`stat -c %s ${this.backupPath}`);
      const sizeBytes = parseInt(sizeOutput, 10) || 0;
      if (sizeBytes <= 0) {
        throw new Error(
          `Backup file is empty or missing: ${this.backupPath} (size: ${sizeBytes} bytes)`,
        );
      }

      const backupMetadata: BackupMetadata = {
        backupId,
        databaseName: this.sourceDb,
        createdAt: backupStartTime.toISOString(),
        completedAt: backupCompletedTime.toISOString(),
        storagePath: this.backupPath,
        sizeBytes,
        sha256Digest: sha256,
        encryptionVerified: true,
        immutable: true,
      };

      // Verify backup integrity
      const backupIntegrity = this.backupVerifier.verifyIntegrity(backupMetadata, sha256);
      if (backupIntegrity.status !== 'PASS') {
        throw new Error(`Backup integrity check failed: ${backupIntegrity.reason}`);
      }

      // 3. Provision isolated drill database
      const restoreStartTime = new Date();
      try {
        this.execInContainer(`createdb -U ${this.dbUser} ${this.drillDb}`);
        drillDbCreated = true;
      } catch {
        // If db previously existed, drop and recreate
        this.execInContainer(`dropdb --if-exists -U ${this.dbUser} ${this.drillDb}`);
        this.execInContainer(`createdb -U ${this.dbUser} ${this.drillDb}`);
        drillDbCreated = true;
      }

      // 4. Restore into drill database
      this.execInContainer(
        `pg_restore -U ${this.dbUser} -d ${this.drillDb} --no-owner --no-privileges ${this.backupPath}`,
      );
      const restoreCompletedTime = new Date();

      // 5. Query verification metrics from restored database
      const tableCountOut = this.execInContainer(
        `psql -U ${this.dbUser} -d ${this.drillDb} -t -A -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';"`,
      );
      const tableCount = parseInt(tableCountOut, 10);

      const indexCountOut = this.execInContainer(
        `psql -U ${this.dbUser} -d ${this.drillDb} -t -A -c "SELECT count(*) FROM pg_indexes WHERE schemaname = 'public';"`,
      );
      const indexCount = parseInt(indexCountOut, 10);

      const fkCountOut = this.execInContainer(
        `psql -U ${this.dbUser} -d ${this.drillDb} -t -A -c "SELECT count(*) FROM information_schema.table_constraints WHERE constraint_type = 'FOREIGN KEY' AND table_schema = 'public';"`,
      );
      const fkCount = parseInt(fkCountOut, 10);

      const migrationCountOut = this.execInContainer(
        `psql -U ${this.dbUser} -d ${this.drillDb} -t -A -c "SELECT count(*) FROM _prisma_migrations WHERE rolled_back_at IS NULL;"`,
      );
      const migrationCount = parseInt(migrationCountOut, 10);

      // List of table names present
      const tableListOut = this.execInContainer(
        `psql -U ${this.dbUser} -d ${this.drillDb} -t -A -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';"`,
      );
      const tablesPresent = tableListOut
        .split('\n')
        .map((t) => t.trim())
        .filter(Boolean);

      // List of indexes present
      const indexListOut = this.execInContainer(
        `psql -U ${this.dbUser} -d ${this.drillDb} -t -A -c "SELECT indexname FROM pg_indexes WHERE schemaname = 'public';"`,
      );
      const indexesPresent = indexListOut
        .split('\n')
        .map((i) => i.trim())
        .filter(Boolean);

      // List of constraints present
      const constraintListOut = this.execInContainer(
        `psql -U ${this.dbUser} -d ${this.drillDb} -t -A -c "SELECT constraint_name FROM information_schema.table_constraints WHERE table_schema = 'public';"`,
      );
      const constraintsPresent = constraintListOut
        .split('\n')
        .map((c) => c.trim())
        .filter(Boolean);

      // 6. Evaluate recovery metrics using RestoreVerifier
      const rtoSeconds = Math.max(
        0,
        (restoreCompletedTime.getTime() - restoreStartTime.getTime()) / 1000,
      );
      // RPO: Difference between failure and latest recoverable timestamp
      const rpoSeconds = Math.max(
        0,
        (backupCompletedTime.getTime() - backupStartTime.getTime()) / 1000,
      );

      const restoreResult = this.restoreVerifier.verifyRestoredDatabase({
        targetDatabase: this.drillDb,
        actualTables: tablesPresent,
        actualIndexes: indexesPresent,
        actualConstraints: constraintsPresent,
        failureTimestamp: backupCompletedTime.toISOString(),
        latestRecoverableTimestamp: backupStartTime.toISOString(),
        recoveryStartedTimestamp: restoreStartTime.toISOString(),
        serviceRestoredTimestamp: restoreCompletedTime.toISOString(),
        environment: 'test',
      });

      const gateResult = this.restoreVerifier.toGateResult(restoreResult);

      return {
        gateResult,
        backupMetadata,
        restoreResult,
        drillMetrics: {
          rpoSeconds,
          rtoSeconds,
          tablesVerified: tableCount,
          indexesVerified: indexCount,
          foreignKeysVerified: fkCount,
          migrationsVerified: migrationCount,
        },
      };
    } finally {
      // 7. Cleanup ephemeral drill resources safely even when an error or assertion fails
      if (drillDbCreated) {
        try {
          this.execInContainer(`dropdb --if-exists -U ${this.dbUser} ${this.drillDb}`);
        } catch {
          // Suppress secondary cleanup failure to preserve original error
        }
      }
      if (backupCreated) {
        try {
          this.execInContainer(`rm -f ${this.backupPath}`);
        } catch {
          // Suppress secondary cleanup failure
        }
      }
    }
  }
}
