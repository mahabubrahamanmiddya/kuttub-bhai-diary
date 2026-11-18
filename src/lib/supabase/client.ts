import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl.startsWith("http") &&
  supabaseAnonKey !== "your-anon-key-here"
);

export function createClient() {
  if (!isSupabaseConfigured) {
    // Return dummy client if not configured yet, so UI does not crash on import
    return null;
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

export const supabase = isSupabaseConfigured ? createBrowserClient(supabaseUrl, supabaseAnonKey) : null;
