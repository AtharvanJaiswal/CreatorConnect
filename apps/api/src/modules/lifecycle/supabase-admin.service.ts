import pino, { type Logger } from 'pino';
import { loggerConfig } from '../../plugins/logger.js';

const logger: Logger = pino(loggerConfig);

export interface SupabaseDeleteResult {
  supabaseAuthId: string;
  deleted: boolean;
  alreadyAbsent: boolean;
}

export interface ISupabaseAdminService {
  deleteUserIdentity(supabaseAuthId: string): Promise<SupabaseDeleteResult>;
}

export interface SupabaseAdminConfig {
  supabaseUrl?: string;
  serviceRoleKey?: string;
  maxRetries?: number;
  baseDelayMs?: number;
}

export class SupabaseAdminService implements ISupabaseAdminService {
  private supabaseUrl: string;
  private serviceRoleKey: string;
  private maxRetries: number;
  private baseDelayMs: number;

  constructor(config?: SupabaseAdminConfig) {
    this.supabaseUrl =
      config?.supabaseUrl ||
      process.env.SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      'https://mock.supabase.co';
    this.serviceRoleKey =
      config?.serviceRoleKey || process.env.SUPABASE_SERVICE_ROLE_KEY || 'mock_service_key';
    this.maxRetries = config?.maxRetries ?? 3;
    this.baseDelayMs = config?.baseDelayMs ?? 100;
  }

  /**
   * Deletes a user identity from Supabase Auth Admin.
   * Treats 404 (User not found) as an idempotent success.
   * Retries transient network/5xx/429 errors with exponential backoff and jitter.
   */
  public async deleteUserIdentity(supabaseAuthId: string): Promise<SupabaseDeleteResult> {
    const url = `${this.supabaseUrl.replace(/\/$/, '')}/auth/v1/admin/users/${encodeURIComponent(supabaseAuthId)}`;

    let attempt = 0;
    while (attempt <= this.maxRetries) {
      attempt++;
      try {
        const response = await fetch(url, {
          method: 'DELETE',
          headers: {
            apikey: this.serviceRoleKey,
            Authorization: `Bearer ${this.serviceRoleKey}`,
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(10000), // 10s request safety timeout
        });

        if (response.ok) {
          logger.info(
            {
              event: 'SUPABASE_IDENTITY_DELETED',
              supabaseAuthId,
            },
            'Supabase identity deleted successfully.',
          );
          return { supabaseAuthId, deleted: true, alreadyAbsent: false };
        }

        // 404 User Not Found is an idempotent success
        if (response.status === 404) {
          logger.info(
            {
              event: 'SUPABASE_IDENTITY_ALREADY_ABSENT',
              supabaseAuthId,
            },
            'Supabase identity was already absent (idempotent success).',
          );
          return { supabaseAuthId, deleted: true, alreadyAbsent: true };
        }

        // Rate limit (429) or Server error (5xx) -> retryable
        if (response.status === 429 || (response.status >= 500 && response.status < 600)) {
          const delay = this.calculateDelay(attempt);
          logger.warn(
            {
              event: 'SUPABASE_DELETE_RETRYABLE_ERROR',
              status: response.status,
              attempt,
              delay,
              supabaseAuthId,
            },
            'Transient error calling Supabase Admin API. Retrying...',
          );
          await this.sleep(delay);
          continue;
        }

        // 4xx client errors (400, 401, 403) are non-retryable permanent errors
        const errorBody = await response.text().catch(() => '');
        throw new Error(
          `Supabase Admin API rejected identity deletion with permanent status ${response.status}: ${errorBody}`,
        );
      } catch (err: any) {
        if (attempt > this.maxRetries || err.message?.includes('permanent status')) {
          logger.error(
            {
              event: 'SUPABASE_DELETE_FAILED',
              err: err.message,
              supabaseAuthId,
              attempt,
            },
            'Supabase identity deletion failed definitively.',
          );
          throw err;
        }

        const delay = this.calculateDelay(attempt);
        await this.sleep(delay);
      }
    }

    throw new Error(
      `Failed to delete Supabase identity ${supabaseAuthId} after ${this.maxRetries} retries.`,
    );
  }

  private calculateDelay(attempt: number): number {
    const exp = Math.min(attempt - 1, 5);
    const exponential = this.baseDelayMs * Math.pow(2, exp);
    const jitter = Math.floor(Math.random() * 50);
    return exponential + jitter;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * In-memory Mock Supabase Admin Service for isolated unit and integration testing.
 */
export class MockSupabaseAdminService implements ISupabaseAdminService {
  public users = new Set<string>();

  public async deleteUserIdentity(supabaseAuthId: string): Promise<SupabaseDeleteResult> {
    if (this.users.has(supabaseAuthId)) {
      this.users.delete(supabaseAuthId);
      return { supabaseAuthId, deleted: true, alreadyAbsent: false };
    }
    return { supabaseAuthId, deleted: true, alreadyAbsent: true };
  }
}

export const supabaseAdminService = new SupabaseAdminService();
