import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase client for authentication.
 *
 * Keys are managed through the Freebuff Keys/API keys UI — set
 * `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (VITE_ prefix exposes them
 * to the browser bundle). Until both are present the app keeps running with
 * auth disabled and the /auth page shows a setup notice.
 */
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  : null;
