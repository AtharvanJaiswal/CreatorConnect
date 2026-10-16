import { describe, it, expect } from 'vitest';
import {
  ConfigurationReadinessCheck,
  MigrationSequenceReadinessCheck,
  FinancialInvariantReadinessCheck,
  CloudVpcReadinessCheck,
  CloudDatabaseReadinessCheck,
  CloudRedisReadinessCheck,
  CloudSecretsManagerReadinessCheck,
  CloudAlertRoutingReadinessCheck,
  CloudPitrReadinessCheck,
  StagingPreflightRunner,
} from './staging-preflight.js';
import { ReadinessEvaluator, PHASE_6_RELEASE_GATE_DEFINITIONS } from './readiness-evaluator.js';
import type { ReleaseGateRecord } from './gate-types.js';

describe('StagingPreflightRunner & Readiness Checks (Workstream A & B)', () => {
  const validStagingEnv = {
    NODE_ENV: 'staging',
    DATABASE_URL: 'postgresql://test_user:test_pass@localhost:5432/creatorconnect_staging',
    REDIS_URL: 'rediss://:test_redis_pass@localhost:6379/0',
    SUPABASE_JWT_ISSUER: 'https://auth.staging.creatorconnect.com/auth/v1',
    CORS_ORIGIN: 'https://staging.creatorconnect.com',
    RAZORPAY_KEY_ID: 'rzp_test_1234567890',
  };

  it('ConfigurationReadinessCheck passes with valid staging configuration and redacts secrets', async () => {
    const check = new ConfigurationReadinessCheck();
    const result = await check.run({
      environment: 'staging',
      envVars: validStagingEnv,
    });

    expect(result.status).toBe('PASS');
    expect(result.reason).toBeUndefined();

    // Verify secret redaction
    const dbEvidence = result.evidence.find((e) => e.type === 'SECRET_REDACTED');
    expect(dbEvidence).toBeDefined();
    expect(dbEvidence?.uriOrData).toBe('postgresql://***:***@***:***/***');
    expect(JSON.stringify(result)).not.toContain('test_pass');
    expect(JSON.stringify(result)).not.toContain('test_redis_pass');
  });

  it('ConfigurationReadinessCheck rejects wildcard CORS_ORIGIN in staging mode', async () => {
    const check = new ConfigurationReadinessCheck();
    const result = await check.run({
      environment: 'staging',
      envVars: {
        ...validStagingEnv,
        CORS_ORIGIN: 'https://staging.creatorconnect.com, *',
      },
    });

    expect(result.status).toBe('FAIL');
    expect(result.reason).toContain('Wildcard CORS_ORIGIN (*) is strictly prohibited');
  });

  it('ConfigurationReadinessCheck rejects live Razorpay keys (rzp_live_*)', async () => {
    const check = new ConfigurationReadinessCheck();
    const result = await check.run({
      environment: 'staging',
      envVars: {
        ...validStagingEnv,
        RAZORPAY_KEY_ID: 'rzp_live_secret123456',
      },
    });

    expect(result.status).toBe('FAIL');
    expect(result.reason).toContain('Live Razorpay key (rzp_live_*) detected');
  });

  it('MigrationSequenceReadinessCheck verifies all 8 sequential migrations', async () => {
    const check = new MigrationSequenceReadinessCheck();
    const result = await check.run({ environment: 'staging' });

    expect(result.status).toBe('PASS');
    expect(result.evidence.length).toBe(8);
    expect(result.evidence[0]?.description).toContain('0001_init_identity_and_roles');
    expect(result.evidence[7]?.description).toContain('0008_reviews_and_reputation');
  });

  it('FinancialInvariantReadinessCheck verifies double-entry rules and integer minor units', async () => {
    const check = new FinancialInvariantReadinessCheck();
    const result = await check.run({ environment: 'staging' });

    expect(result.status).toBe('PASS');
    expect(
      result.evidence.some((e) => e.description.includes('sum(debits) - sum(credits) == 0')),
    ).toBe(true);
    expect(result.evidence.some((e) => e.description.includes('integer minor units'))).toBe(true);
  });

  it('Cloud prerequisite checks report BLOCKED or NOT_VERIFIED when cloud resources are absent', async () => {
    const vpcCheck = new CloudVpcReadinessCheck();
    const vpcResult = await vpcCheck.run({ environment: 'staging', envVars: {} });
    expect(vpcResult.status).toBe('BLOCKED');
    expect(vpcResult.remediation).toBeDefined();

    const dbCheck = new CloudDatabaseReadinessCheck();
    const dbResult = await dbCheck.run({ environment: 'staging', envVars: {} });
    expect(dbResult.status).toBe('BLOCKED');

    const redisCheck = new CloudRedisReadinessCheck();
    const redisResult = await redisCheck.run({ environment: 'staging', envVars: {} });
    expect(redisResult.status).toBe('BLOCKED');

    const secretsCheck = new CloudSecretsManagerReadinessCheck();
    const secretsResult = await secretsCheck.run({ environment: 'staging', envVars: {} });
    expect(secretsResult.status).toBe('BLOCKED');

    const alertCheck = new CloudAlertRoutingReadinessCheck();
    const alertResult = await alertCheck.run({ environment: 'staging', envVars: {} });
    expect(alertResult.status).toBe('NOT_VERIFIED');

    const pitrCheck = new CloudPitrReadinessCheck();
    const pitrResult = await pitrCheck.run({ environment: 'staging', envVars: {} });
    expect(pitrResult.status).toBe('NOT_VERIFIED');
  });

  it('StagingPreflightRunner evaluates overall status as BLOCKED and disallows staging activation without cloud resources', async () => {
    const runner = new StagingPreflightRunner();
    const report = await runner.runPreflight({
      environment: 'staging',
      envVars: validStagingEnv,
    });

    expect(report.overallStatus).toBe('BLOCKED');
    expect(report.stagingActivationAllowed).toBe(false);
    expect(report.blockedChecks).toBeGreaterThan(0);
    expect(report.summary).toContain('required cloud prerequisite(s) are not provisioned');
  });

  it('StagingPreflightRunner allows activation when all prerequisites are fulfilled', async () => {
    const runner = new StagingPreflightRunner();
    const fullyProvisionedEnv = {
      ...validStagingEnv,
      STAGING_VPC_ID: 'vpc-cc-staging-12345',
      STAGING_DB_HOST: 'creatorconnect-staging.cluster-xyz.ap-south-1.rds.amazonaws.com',
      STAGING_REDIS_HOST: 'cc-staging-redis.xyz.cache.amazonaws.com',
      STAGING_SECRET_ARN:
        'arn:aws:secretsmanager:ap-south-1:123456789012:secret:creatorconnect/staging/app',
      ALERTMANAGER_URL: 'https://alertmanager.staging.creatorconnect.com',
      STAGING_PITR_DRILL_COMPLETED_AT: '2026-10-16T15:00:00Z',
    };

    const report = await runner.runPreflight({
      environment: 'staging',
      envVars: fullyProvisionedEnv,
    });

    expect(report.overallStatus).toBe('PASS');
    expect(report.stagingActivationAllowed).toBe(true);
    expect(report.failedChecks).toBe(0);
    expect(report.blockedChecks).toBe(0);
    expect(report.notVerifiedChecks).toBe(0);
  });
});

describe('ReadinessEvaluator.evaluateReleaseGates (Workstream I)', () => {
  const evaluator = new ReadinessEvaluator();
  const now = new Date();

  const createGateRecord = (
    id: string,
    title: string,
    status: ReleaseGateRecord['status'],
    scope: ReleaseGateRecord['scope'],
    actualEvidence: string[],
    options?: Partial<ReleaseGateRecord>,
  ): ReleaseGateRecord => ({
    id,
    title,
    status,
    scope,
    requiredEvidence: [],
    actualEvidence,
    checkedAt: now.toISOString(),
    verifier: 'TestVerifier',
    responsibleOwner: 'Lead',
    ...options,
  });

  it('correctly models current baseline state: Staging is CONDITIONAL GO, Production is NO-GO', () => {
    const currentRecords: ReleaseGateRecord[] = [
      createGateRecord(
        'GATE_A_DATABASE_FINANCIAL_RESILIENCE',
        'Database & Financial Resilience',
        'PASS',
        'local',
        [
          'Sequential migration history (0001-0008)',
          'Double-entry accounting invariant: sum(debits) == sum(credits)',
          'Integer minor units (paise) representation',
          'Cumulative partial-refund fee reversal telescoping formula',
        ],
      ),
      createGateRecord(
        'GATE_B_MONITORING_ALERTING',
        'Observability Telemetry & Alert Delivery',
        'NOT_VERIFIED',
        'staging_cloud',
        ['Fastify health and readiness probes passing'],
        { reason: 'Staging Alertmanager drill pending' },
      ),
      createGateRecord(
        'GATE_C_MANAGED_SECRETS_CLOUD_KMS',
        'Managed Secrets & KMS',
        'BLOCKED',
        'staging_cloud',
        ['Zero static .env files in container filesystem'],
        { reason: 'Cloud KMS staging token not provisioned in local environment' },
      ),
      createGateRecord(
        'GATE_D_LEGAL_BANKING_COMPLIANCE',
        'Legal, Banking & Compliance',
        'BLOCKED',
        'stakeholder_approval',
        ['Review packet complete'],
        { reason: 'Written legal and banking approvals pending' },
      ),
      createGateRecord(
        'GATE_E_DEPENDENCY_SECURITY',
        'Dependency Security Audit',
        'PASS',
        'ci',
        [
          'Clean production dependency audit: pnpm audit --prod reporting 0 vulnerabilities',
          'Accountable risk acceptance register for dev-only tooling vulnerabilities',
        ],
        {
          riskAcceptance: {
            owner: 'DevSecOps Lead',
            rationale: 'Dev-only tooling vulnerabilities unreachable in production runtime',
            reviewDate: '2026-11-15',
            scope: 'devDependencies',
          },
        },
      ),
      createGateRecord(
        'GATE_F_LOCAL_ENGINEERING_QUALITY',
        'Local Engineering Quality',
        'PASS',
        'local',
        [
          'Zero lint warnings/errors across all 13 workspace packages',
          'Zero TypeScript compiler errors across all workspace packages',
          '100% Prettier formatting compliance',
          'All unit test suites passing (624/624 tests)',
          'All E2E browser tests passing (23/23 tests)',
        ],
      ),
      createGateRecord('GATE_G_REMOTE_CI', 'Remote CI Validation', 'PASS', 'ci', [
        'PR Validation & Quality Gates workflow green on candidate SHA',
        'CodeQL Security Analysis workflow green (0 alerts) on candidate SHA',
      ]),
      createGateRecord(
        'GATE_H_CLOUD_PITR_DISASTER_RECOVERY',
        'Cloud PITR Disaster Recovery',
        'NOT_VERIFIED',
        'staging_cloud',
        ['Local container restore drill passed (6.7s RTO, 48 tables)'],
        { reason: 'Continuous WAL streaming drill pending on staging Aurora' },
      ),
    ];

    const result = evaluator.evaluateReleaseGates(
      PHASE_6_RELEASE_GATE_DEFINITIONS,
      currentRecords,
      now,
    );

    expect(result.overallStatus).toBe('BLOCKED');
    expect(result.canDeployStaging).toBe(true); // Staging is conditional GO
    expect(result.canDeployProduction).toBe(false); // Production is strictly NO-GO
    expect(result.liveFinancialTransactionsAllowed).toBe(false); // Live payments strictly prohibited
    expect(result.summary).toContain('BLOCKED');
  });

  it('rejects attempt to close cloud gate using local scope evidence', () => {
    const invalidCloudAttempt: ReleaseGateRecord[] = [
      createGateRecord(
        'GATE_H_CLOUD_PITR_DISASTER_RECOVERY',
        'Cloud PITR Disaster Recovery',
        'PASS',
        'local', // Attempting to pass cloud gate with local scope!
        [
          'Empirical staging Aurora PostgreSQL continuous WAL recovery drill',
          'Measured RPO <= 5.0s evaluated via recovery-point age and sequence gap',
          'Measured RTO <= 900.0s (incident start to verified read/write restoration)',
          'Post-restore double-entry ledger balance verification (difference == 0 paise)',
        ],
      ),
    ];

    const result = evaluator.evaluateReleaseGates(
      [
        PHASE_6_RELEASE_GATE_DEFINITIONS.find(
          (g) => g.id === 'GATE_H_CLOUD_PITR_DISASTER_RECOVERY',
        )!,
      ],
      invalidCloudAttempt,
      now,
    );

    // Must be rejected as NOT_VERIFIED due to scope violation
    expect(result.gateRecords['GATE_H_CLOUD_PITR_DISASTER_RECOVERY']?.status).toBe('NOT_VERIFIED');
    expect(result.gateRecords['GATE_H_CLOUD_PITR_DISASTER_RECOVERY']?.reason).toContain(
      'Scope violation: local evidence cannot satisfy',
    );
  });

  it('rejects attempt to close stakeholder approval gate using technical check', () => {
    const invalidLegalAttempt: ReleaseGateRecord[] = [
      createGateRecord(
        'GATE_D_LEGAL_BANKING_COMPLIANCE',
        'Legal, Banking & Compliance',
        'PASS',
        'local', // Attempting to pass legal approval with local technical check!
        [
          'Legal counsel formal written sign-off under RBI PA/PG Guidelines',
          'Scheduled commercial partner bank tripartite nodal/escrow merchant sign-off',
          'Chief Financial Officer formal fee schedule and dispute reserve sign-off',
        ],
      ),
    ];

    const result = evaluator.evaluateReleaseGates(
      [PHASE_6_RELEASE_GATE_DEFINITIONS.find((g) => g.id === 'GATE_D_LEGAL_BANKING_COMPLIANCE')!],
      invalidLegalAttempt,
      now,
    );

    // Must be rejected as BLOCKED
    expect(result.gateRecords['GATE_D_LEGAL_BANKING_COMPLIANCE']?.status).toBe('BLOCKED');
    expect(result.gateRecords['GATE_D_LEGAL_BANKING_COMPLIANCE']?.reason).toContain(
      'Scope violation',
    );
  });
});
