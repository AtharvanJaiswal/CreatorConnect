import { describe, it, expect } from 'vitest';
import { ConfigurationVerifier, PRODUCTION_CONFIGURATION_RULES } from './configuration-verifier.js';

describe('ConfigurationVerifier', () => {
  const verifier = new ConfigurationVerifier();

  const validTestEnv: Record<string, string> = {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://postgres:secretpassword@postgres:5432/creatorconnect_prod',
    REDIS_URL: 'redis://:redispassword@redis:6379',
    SUPABASE_JWT_ISSUER: 'https://auth.creatorconnect.app/auth/v1',
    SUPABASE_JWKS_URL: 'https://auth.creatorconnect.app/auth/v1/.well-known/jwks.json',
    CORS_ORIGIN: 'https://creatorconnect.app, https://admin.creatorconnect.app',
    CLAMAV_HOST: 'clamav.internal',
    CLAMAV_PORT: '3310',
  };

  it('should PASS when all required production configurations are valid', () => {
    const result = verifier.verify(validTestEnv, 'production');
    expect(result.status).toBe('PASS');
    expect(result.totalChecked).toBe(PRODUCTION_CONFIGURATION_RULES.length);
    expect(result.failedCount).toBe(0);

    // Verify sanitization: no secrets should appear in evidence
    for (const check of result.checks) {
      expect(check.status).toBe('PASS');
      expect(check.sanitizedFormat).not.toContain('secretpassword');
      expect(check.sanitizedFormat).not.toContain('redispassword');
    }

    const gate = verifier.toGateResult(result);
    expect(gate.id).toBe('GATE_C_PRODUCTION_CONFIGURATION');
    expect(gate.status).toBe('PASS');
  });

  it('should FAIL when required configuration keys are missing in production', () => {
    const incompleteEnv = { ...validTestEnv };
    delete incompleteEnv.DATABASE_URL;
    delete incompleteEnv.REDIS_URL;

    const result = verifier.verify(incompleteEnv, 'production');
    expect(result.status).toBe('FAIL');
    expect(result.failedCount).toBe(2);

    const dbCheck = result.checks.find((c) => c.key === 'DATABASE_URL');
    expect(dbCheck?.status).toBe('FAIL');
    expect(dbCheck?.reason).toContain('is missing or empty');

    const gate = verifier.toGateResult(result);
    expect(gate.status).toBe('FAIL');
    expect(gate.reason).toContain('2 configuration check(s) failed');
  });

  it('should FAIL in production if CORS_ORIGIN contains a wildcard (*)', () => {
    const wildcardEnv = {
      ...validTestEnv,
      CORS_ORIGIN: '*',
    };

    const result = verifier.verify(wildcardEnv, 'production');
    expect(result.status).toBe('FAIL');

    const corsCheck = result.checks.find((c) => c.key === 'CORS_ORIGIN');
    expect(corsCheck?.status).toBe('FAIL');
    expect(corsCheck?.reason).toContain('Wildcard CORS_ORIGIN (*) is strictly prohibited');
  });

  it('should FAIL in production if SUPABASE_JWT_ISSUER references localhost or non-https', () => {
    const devIssuerEnv = {
      ...validTestEnv,
      SUPABASE_JWT_ISSUER: 'http://localhost:54321/auth/v1',
    };

    const result = verifier.verify(devIssuerEnv, 'production');
    expect(result.status).toBe('FAIL');

    const issuerCheck = result.checks.find((c) => c.key === 'SUPABASE_JWT_ISSUER');
    expect(issuerCheck?.status).toBe('FAIL');
    expect(issuerCheck?.reason).toContain('cannot reference localhost');
  });

  it('should FAIL if CLAMAV_PORT is not a valid port number', () => {
    const invalidPortEnv = {
      ...validTestEnv,
      CLAMAV_PORT: '999999',
    };

    const result = verifier.verify(invalidPortEnv, 'production');
    expect(result.status).toBe('FAIL');

    const portCheck = result.checks.find((c) => c.key === 'CLAMAV_PORT');
    expect(portCheck?.status).toBe('FAIL');
    expect(portCheck?.reason).toContain('must be an integer between 1 and 65535');
  });
});
