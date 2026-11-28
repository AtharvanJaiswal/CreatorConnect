'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { UserResponse } from '@creatorconnect/contracts';
import { createClient } from '../lib/supabase';
import { apiClient } from '../lib/api-client';

interface AuthContextType {
  user: UserResponse | null;
  session: Session | null;
  accessToken: string | null;
  isLoading: boolean;
  authError: string | null;
  login: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (
    email: string,
    password: string,
    preferredRole?: string,
  ) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function getTestAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return (
    (window as { __TEST_ACCESS_TOKEN__?: string }).__TEST_ACCESS_TOKEN__ ||
    localStorage.getItem('creatorconnect_test_access_token')
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [supabase] = useState(() => createClient());
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<UserResponse | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const tokenRef = useRef<string | null>(null);

  tokenRef.current = accessToken;

  // Bind ApiClient token resolution to active AuthProvider session with test-token fallback
  apiClient.setTokenGetter(() => tokenRef.current || getTestAccessToken());

  const fetchUserProfile = async (token: string): Promise<{ error: string | null }> => {
    try {
      const res = await fetch('/api/v1/users/me', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const data: UserResponse = await res.json();
        setUser(data);
        setAuthError(null);
        return { error: null };
      }

      if (res.status === 401) {
        // Identity not synced yet -> attempt sync with backend
        const syncRes = await fetch('/api/v1/auth/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({}),
        });

        if (syncRes.ok) {
          const syncData = await syncRes.json();
          setUser(syncData.user);
          setAuthError(null);
          return { error: null };
        }
      }

      // 403 (suspended/deactivated) or unrecoverable 401/500: clear user state strictly
      let detail = `Authentication check rejected (HTTP ${res.status})`;
      try {
        const problem = await res.json();
        if (problem?.detail) detail = problem.detail;
      } catch {
        // Ignore parse failures
      }
      setUser(null);
      setAuthError(detail);
      return { error: detail };
    } catch {
      const detail = 'Unable to verify staff identity with the backend API.';
      setUser(null);
      setAuthError(detail);
      return { error: detail };
    }
  };

  useEffect(() => {
    const testToken = getTestAccessToken();

    if (testToken) {
      setAccessToken(testToken);
      tokenRef.current = testToken;
      fetchUserProfile(testToken).finally(() => {
        setIsLoading(false);
      });
      return;
    }

    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession);
      if (initialSession?.access_token) {
        setAccessToken(initialSession.access_token);
        tokenRef.current = initialSession.access_token;
        fetchUserProfile(initialSession.access_token).finally(() => {
          setIsLoading(false);
        });
      } else {
        setIsLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      setSession(currentSession);
      if (currentSession?.access_token) {
        setAccessToken(currentSession.access_token);
        tokenRef.current = currentSession.access_token;
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          await fetchUserProfile(currentSession.access_token);
        }
      } else {
        setAccessToken(null);
        tokenRef.current = null;
        setUser(null);
      }
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  const login = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { error: error.message };
      }

      if (data.session) {
        setSession(data.session);
        setAccessToken(data.session.access_token);
        tokenRef.current = data.session.access_token;
        const profileRes = await fetchUserProfile(data.session.access_token);
        if (profileRes.error) {
          return { error: profileRes.error };
        }
      }

      return { error: null };
    } catch (err: unknown) {
      return { error: err instanceof Error ? err.message : 'Login failed' };
    }
  };

  const signUp = async (email: string, password: string, preferredRole?: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        return { error: error.message };
      }

      if (data.session?.access_token) {
        setSession(data.session);
        setAccessToken(data.session.access_token);
        tokenRef.current = data.session.access_token;

        await fetch('/api/v1/auth/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${data.session.access_token}`,
          },
          body: JSON.stringify({ preferredRole }),
        });

        await fetchUserProfile(data.session.access_token);
      }

      return { error: null };
    } catch (err: unknown) {
      return { error: err instanceof Error ? err.message : 'Registration failed' };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    if (typeof window !== 'undefined') {
      delete (window as { __TEST_ACCESS_TOKEN__?: string }).__TEST_ACCESS_TOKEN__;
      localStorage.removeItem('creatorconnect_test_access_token');
    }
    setSession(null);
    setAccessToken(null);
    tokenRef.current = null;
    setUser(null);
    setAuthError(null);
  };

  const refreshUser = async () => {
    const activeToken = tokenRef.current || getTestAccessToken();
    if (activeToken) {
      await fetchUserProfile(activeToken);
    } else {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        accessToken,
        isLoading,
        authError,
        login,
        signUp,
        signOut,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
