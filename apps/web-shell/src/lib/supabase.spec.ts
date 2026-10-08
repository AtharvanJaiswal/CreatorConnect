import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { validateSupabaseConfig } from './supabase';

describe('Supabase Client Configuration (Phase I)', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('throws a clear error when NEXT_PUBLIC_SUPABASE_URL is missing', () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

    expect(() => validateSupabaseConfig()).toThrow(/NEXT_PUBLIC_SUPABASE_URL is missing/i);
  });

  it('throws a clear error when NEXT_PUBLIC_SUPABASE_ANON_KEY is missing', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://valid-project.supabase.co';
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    expect(() => validateSupabaseConfig()).toThrow(/NEXT_PUBLIC_SUPABASE_ANON_KEY is missing/i);
  });

  it('prohibits service_role key from being supplied to browser configuration', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://valid-project.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'service_role_secret_key_12345';

    expect(() => validateSupabaseConfig()).toThrow(/service_role secret key must NEVER be used/i);
  });

  it('prohibits silent mock fallbacks in non-test runtime mode', () => {
    (process.env as any).NODE_ENV = 'production';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://mock.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'mock-anon-key';

    expect(() => validateSupabaseConfig()).toThrow(/Silent mock fallbacks are prohibited/i);
  });

  it('successfully returns sanitized configuration when valid variables are present', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://myproject.supabase.co ';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = ' sb_publishable_valid_key ';

    const config = validateSupabaseConfig();
    expect(config.supabaseUrl).toBe('https://myproject.supabase.co');
    expect(config.supabaseAnonKey).toBe('sb_publishable_valid_key');
  });
});
