import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isSupabaseConfigured } from '@/lib/supabase/client';

export interface AuthenticatedUser {
  id: string;
  email?: string;
  [key: string]: any;
}

/**
 * Validates the caller's session token from the Authorization header or cookie.
 * Returns the authenticated user record from Supabase, or null if unauthenticated.
 */
export async function getAuthenticatedUser(req: NextRequest): Promise<AuthenticatedUser | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  // 1. Try Authorization header: Bearer <token>
  const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
  let token: string | null = null;
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    token = authHeader.substring(7).trim();
  }

  // 2. Try cookie if not in header (e.g. Supabase auth cookie sb-<ref>-auth-token)
  if (!token) {
    const cookies = req.cookies.getAll();
    const authCookie = cookies.find((c) => c.name.startsWith('sb-') && c.name.endsWith('-auth-token'));
    if (authCookie?.value) {
      try {
        const parsed = JSON.parse(decodeURIComponent(authCookie.value));
        token = Array.isArray(parsed) ? parsed[0] : parsed?.access_token || parsed;
      } catch {
        token = authCookie.value;
      }
    }
  }

  if (!token) {
    return null;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    return null;
  }

  try {
    const supabase = createClient(supabaseUrl, anonKey);
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      return null;
    }

    return user;
  } catch {
    return null;
  }
}
