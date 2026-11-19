'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { getLocalUserId } from '@/lib/storage/offline-store';

interface AuthContextType {
  user: User | { id: string; email: string; user_metadata?: { name?: string } } | null;
  session: Session | null;
  loading: boolean;
  isConfigured: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, name?: string) => Promise<{ error: Error | null; user?: any }>;
  signOut: () => Promise<void>;
  enterDemoMode: (email?: string, name?: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const isConfigured = isSupabaseConfigured();

  useEffect(() => {
    if (!isConfigured) {
      // In local mode, retrieve or create persistent local user
      const localId = getLocalUserId();
      const savedUser = localStorage.getItem('kuttub_diary_demo_user');
      if (savedUser) {
        try {
          setUser(JSON.parse(savedUser));
        } catch {
          setUser({ id: localId, email: 'kuttub@diary.local', user_metadata: { name: 'Kuttub Bhai' } });
        }
      } else {
        const defaultUser = { id: localId, email: 'kuttub@diary.local', user_metadata: { name: 'Kuttub Bhai' } };
        setUser(defaultUser);
        localStorage.setItem('kuttub_diary_demo_user', JSON.stringify(defaultUser));
      }
      setLoading(false);
      return;
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    // Get current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [isConfigured]);

  const signIn = async (email: string, password: string): Promise<{ error: Error | null }> => {
    if (!isConfigured) {
      const demoUser = {
        id: getLocalUserId(),
        email,
        user_metadata: { name: email.split('@')[0] },
      };
      setUser(demoUser);
      localStorage.setItem('kuttub_diary_demo_user', JSON.stringify(demoUser));
      return { error: null };
    }

    const supabase = getSupabaseClient();
    if (!supabase) return { error: new Error('Supabase client not initialized') };

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    return { error: error ? new Error(error.message) : null };
  };

  const signUp = async (
    email: string,
    password: string,
    name?: string
  ): Promise<{ error: Error | null; user?: any }> => {
    if (!isConfigured) {
      const demoUser = {
        id: getLocalUserId(),
        email,
        user_metadata: { name: name || email.split('@')[0] },
      };
      setUser(demoUser);
      localStorage.setItem('kuttub_diary_demo_user', JSON.stringify(demoUser));
      return { error: null, user: demoUser };
    }

    const supabase = getSupabaseClient();
    if (!supabase) return { error: new Error('Supabase client not initialized') };

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: name || email.split('@')[0],
        },
      },
    });

    return {
      error: error ? new Error(error.message) : null,
      user: data.user,
    };
  };

  const signOut = async (): Promise<void> => {
    if (!isConfigured) {
      setUser(null);
      localStorage.removeItem('kuttub_diary_demo_user');
      return;
    }

    const supabase = getSupabaseClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setSession(null);
  };

  const enterDemoMode = (email = 'kuttub@diary.local', name = 'Kuttub Bhai') => {
    const demoUser = {
      id: getLocalUserId(),
      email,
      user_metadata: { name },
    };
    setUser(demoUser);
    localStorage.setItem('kuttub_diary_demo_user', JSON.stringify(demoUser));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        isConfigured,
        signIn,
        signUp,
        signOut,
        enterDemoMode,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
