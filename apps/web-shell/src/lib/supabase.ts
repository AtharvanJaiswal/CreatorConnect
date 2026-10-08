import { createBrowserClient } from '@supabase/ssr';

export interface SupabaseConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

export function validateSupabaseConfig(): SupabaseConfig {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseUrl.trim()) {
    throw new Error(
      'Supabase Configuration Error: NEXT_PUBLIC_SUPABASE_URL is missing. Please configure your environment variables.',
    );
  }

  if (!supabaseAnonKey || !supabaseAnonKey.trim()) {
    throw new Error(
      'Supabase Configuration Error: NEXT_PUBLIC_SUPABASE_ANON_KEY is missing. Please configure your environment variables.',
    );
  }

  // Prevent service role key from leaking into browser client
  if (supabaseAnonKey.startsWith('service_role') || supabaseAnonKey.includes('service_role')) {
    throw new Error(
      'Security Error: Supabase service_role secret key must NEVER be used in client/browser configuration.',
    );
  }

  // Reject mock fallbacks in non-test environments
  if (
    process.env.NODE_ENV !== 'test' &&
    (supabaseUrl.includes('mock.supabase.co') || supabaseAnonKey === 'mock-anon-key')
  ) {
    throw new Error(
      'Supabase Configuration Error: Silent mock fallbacks are prohibited. A valid Supabase instance URL and publishable anon key must be provided.',
    );
  }

  return {
    supabaseUrl: supabaseUrl.trim(),
    supabaseAnonKey: supabaseAnonKey.trim(),
  };
}

export function createClient() {
  const { supabaseUrl, supabaseAnonKey } = validateSupabaseConfig();
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
