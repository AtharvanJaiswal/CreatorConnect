import type {
  ConfigurationCheck,
  ConfigurationVerificationResult,
  ConfigurationStatus,
  OperationalGateResult,
  OperationalEnvironment,
} from './gate-types.js';

export interface EnvironmentVariableRule {
  key: string;
  isSecret: boolean;
  required: boolean;
  productionRequired?: boolean;
  validator: (
    val: string | undefined,
    env: string,
  ) => { valid: boolean; reason?: string | undefined; sanitized: string };
}

export const PRODUCTION_CONFIGURATION_RULES: EnvironmentVariableRule[] = [
  {
    key: 'NODE_ENV',
    isSecret: false,
    required: true,
    validator: (val) => {
      if (!val) return { valid: false, reason: 'Missing NODE_ENV', sanitized: '<unset>' };
      const valid = ['development', 'test', 'staging', 'production'].includes(val);
      return {
        valid,
        reason: valid ? undefined : `Invalid NODE_ENV value: '${val}'`,
        sanitized: val,
      };
    },
  },
  {
    key: 'DATABASE_URL',
    isSecret: true,
    required: true,
    validator: (val) => {
      if (!val) return { valid: false, reason: 'Missing DATABASE_URL', sanitized: '<unset>' };
      const isPostgres = val.startsWith('postgresql://') || val.startsWith('postgres://');
      if (!isPostgres) {
        return {
          valid: false,
          reason: 'DATABASE_URL must be a valid PostgreSQL connection string',
          sanitized: 'invalid-protocol',
        };
      }
      return {
        valid: true,
        reason: undefined,
        sanitized: 'postgresql://***:***@***:***/***',
      };
    },
  },
  {
    key: 'REDIS_URL',
    isSecret: true,
    required: true,
    validator: (val) => {
      if (!val) return { valid: false, reason: 'Missing REDIS_URL', sanitized: '<unset>' };
      const isRedis = val.startsWith('redis://') || val.startsWith('rediss://');
      if (!isRedis) {
        return {
          valid: false,
          reason: 'REDIS_URL must use redis:// or rediss:// protocol',
          sanitized: 'invalid-protocol',
        };
      }
      return { valid: true, reason: undefined, sanitized: 'redis://***:***@***:***/***' };
    },
  },
  {
    key: 'SUPABASE_JWT_ISSUER',
    isSecret: false,
    required: true,
    validator: (val, env) => {
      if (!val)
        return { valid: false, reason: 'Missing SUPABASE_JWT_ISSUER', sanitized: '<unset>' };
      const isProd = env === 'production';
      if (
        isProd &&
        (!val.startsWith('https://') || val.includes('localhost') || val.includes('127.0.0.1'))
      ) {
        return {
          valid: false,
          reason:
            'Production SUPABASE_JWT_ISSUER must be a valid HTTPS URL and cannot reference localhost',
          sanitized: val,
        };
      }
      return { valid: true, reason: undefined, sanitized: val };
    },
  },
  {
    key: 'SUPABASE_JWKS_URL',
    isSecret: false,
    required: false,
    validator: (val, env) => {
      if (!val) return { valid: true, reason: undefined, sanitized: '<default-derived>' };
      const isProd = env === 'production';
      if (
        isProd &&
        (!val.startsWith('https://') || val.includes('localhost') || val.includes('127.0.0.1'))
      ) {
        return {
          valid: false,
          reason:
            'Production SUPABASE_JWKS_URL must be a valid HTTPS URL and cannot reference localhost',
          sanitized: val,
        };
      }
      return { valid: true, reason: undefined, sanitized: val };
    },
  },
  {
    key: 'CORS_ORIGIN',
    isSecret: false,
    required: true,
    validator: (val, env) => {
      if (!val) return { valid: false, reason: 'Missing CORS_ORIGIN', sanitized: '<unset>' };
      const isProd = env === 'production';
      if (isProd && val.includes('*')) {
        return {
          valid: false,
          reason: 'Wildcard CORS_ORIGIN (*) is strictly prohibited in production mode',
          sanitized: '<wildcard-rejected>',
        };
      }
      return {
        valid: true,
        reason: undefined,
        sanitized: val
          .split(',')
          .map((o) => o.trim())
          .join(', '),
      };
    },
  },
  {
    key: 'CLAMAV_HOST',
    isSecret: false,
    required: true,
    validator: (val) => {
      if (!val) return { valid: false, reason: 'Missing CLAMAV_HOST', sanitized: '<unset>' };
      return { valid: true, reason: undefined, sanitized: val };
    },
  },
  {
    key: 'CLAMAV_PORT',
    isSecret: false,
    required: true,
    validator: (val) => {
      if (!val) return { valid: false, reason: 'Missing CLAMAV_PORT', sanitized: '<unset>' };
      const port = Number(val);
      const valid = Number.isInteger(port) && port > 0 && port <= 65535;
      return {
        valid,
        reason: valid
          ? undefined
          : `CLAMAV_PORT must be an integer between 1 and 65535: received '${val}'`,
        sanitized: valid ? String(port) : '<invalid-port>',
      };
    },
  },
];

export class ConfigurationVerifier {
  private readonly rules: EnvironmentVariableRule[];

  constructor(rules: EnvironmentVariableRule[] = PRODUCTION_CONFIGURATION_RULES) {
    this.rules = rules;
  }

  /**
   * Evaluates environment variable configuration safely without disclosing secrets.
   */
  public verify(
    envVars: Record<string, string | undefined>,
    environment: OperationalEnvironment = 'production',
  ): ConfigurationVerificationResult {
    const checks: ConfigurationCheck[] = [];
    const now = new Date().toISOString();

    for (const rule of this.rules) {
      const rawValue = envVars[rule.key];
      const isRequired =
        environment === 'production' && rule.productionRequired !== false ? true : rule.required;

      if (!rawValue && isRequired) {
        checks.push({
          key: rule.key,
          status: 'FAIL',
          environment,
          isSecret: rule.isSecret,
          sanitizedFormat: '<unset>',
          reason: `Required configuration key '${rule.key}' is missing or empty.`,
          checkedAt: now,
        });
        continue;
      }

      if (!rawValue && !isRequired) {
        checks.push({
          key: rule.key,
          status: 'PASS',
          environment,
          isSecret: rule.isSecret,
          sanitizedFormat: '<optional-unset>',
          reason: undefined,
          checkedAt: now,
        });
        continue;
      }

      const outcome = rule.validator(rawValue, environment);
      const status: ConfigurationStatus = outcome.valid ? 'PASS' : 'FAIL';

      checks.push({
        key: rule.key,
        status,
        environment,
        isSecret: rule.isSecret,
        sanitizedFormat: outcome.sanitized,
        reason: outcome.reason,
        checkedAt: now,
      });
    }

    const passedCount = checks.filter((c) => c.status === 'PASS').length;
    const failedCount = checks.filter((c) => c.status === 'FAIL').length;
    const blockedCount = checks.filter((c) => c.status === 'BLOCKED').length;

    const overallStatus: ConfigurationStatus =
      failedCount === 0 && blockedCount === 0 ? 'PASS' : 'FAIL';

    const evidence = checks.map(
      (c) => `${c.key}: ${c.status} (${c.sanitizedFormat})${c.reason ? ` - ${c.reason}` : ''}`,
    );

    return {
      status: overallStatus,
      environment,
      checks,
      totalChecked: checks.length,
      passedCount,
      failedCount,
      blockedCount,
      evidence,
    };
  }

  /**
   * Adapts ConfigurationVerificationResult into an OperationalGateResult.
   */
  public toGateResult(result: ConfigurationVerificationResult): OperationalGateResult {
    return {
      id: 'GATE_C_PRODUCTION_CONFIGURATION',
      name: 'Production Secrets & Environment Configuration Verification Gate',
      status: result.status,
      environment: result.environment,
      evidence: result.evidence,
      checkedAt: new Date().toISOString(),
      reason:
        result.failedCount > 0
          ? `${result.failedCount} configuration check(s) failed out of ${result.totalChecked} rules.`
          : undefined,
    };
  }
}
