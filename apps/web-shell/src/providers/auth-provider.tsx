'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { UserResponse } from '@creatorconnect/contracts';
import { createClient } from '../lib/supabase';

interface AuthContextType {
  user: UserResponse | null;
  session: Session | null;
  accessToken: string | null;
  isLoading: boolean;
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [supabase] = useState(() => createClient());
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<UserResponse | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchUserProfile = async (token: string) => {
    try {
      const res = await fetch('/api/v1/users/me', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const data: UserResponse = await res.json();
        setUser(data);
      } else if (res.status === 401) {
        // Identity not synced yet -> trigger sync
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
        }
      }
    } catch {
      // In offline / mock dev mode, set mock session user
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession);
      if (initialSession?.access_token) {
        setAccessToken(initialSession.access_token);
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
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          await fetchUserProfile(currentSession.access_token);
        }
      } else {
        setAccessToken(null);
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
        await fetchUserProfile(data.session.access_token);
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

        // Sync with backend API
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
    setSession(null);
    setAccessToken(null);
    setUser(null);
  };

  const refreshUser = async () => {
    if (accessToken) {
      await fetchUserProfile(accessToken);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        accessToken,
        isLoading,
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
