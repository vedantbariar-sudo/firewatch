import { api } from "@/convex/_generated/api";
import { useConvexAuth, useQuery } from "convex/react";
import { supabase } from "@/lib/supabase";

/**
 * Auth hook for the app. Sessions are owned by Supabase; Convex verifies the
 * Supabase access token (see src/hooks/use-supabase-auth.ts and
 * src/convex/auth.config.ts), so `isAuthenticated` here reflects whether
 * Convex accepted the token and `user` is the Convex-side profile.
 */
export function useAuth() {
  const { isLoading: isAuthLoading, isAuthenticated } = useConvexAuth();
  const user = useQuery(api.users.currentUser);

  // Derive isLoading directly from the dependencies instead of managing separate state
  const isLoading = isAuthLoading || user === undefined;

  return {
    isLoading,
    isAuthenticated,
    user,
    signInWithPassword,
    signUp,
    signInAnonymously,
    signOut,
  };
}

async function requireSupabase() {
  if (!supabase) {
    throw new Error(
      "Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in the Keys tab.",
    );
  }
  return supabase;
}

export async function signInWithPassword(email: string, password: string) {
  const client = await requireSupabase();
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

/**
 * Create an account. Returns `needsEmailConfirmation` when Supabase is set to
 * require email verification and no session was issued yet.
 */
export async function signUp(
  email: string,
  password: string,
): Promise<{ needsEmailConfirmation: boolean }> {
  const client = await requireSupabase();
  const { data, error } = await client.auth.signUp({ email, password });
  if (error) throw error;
  return { needsEmailConfirmation: data.session === null };
}

/** Guest access via Supabase anonymous sign-in (enable it in the dashboard). */
export async function signInAnonymously() {
  const client = await requireSupabase();
  const { error } = await client.auth.signInAnonymously();
  if (error) throw error;
}

export async function signOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
}
