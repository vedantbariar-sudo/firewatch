import type { Session } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

/**
 * Auth bridge for `ConvexProviderWithAuth`.
 *
 * Supabase owns the session (sign-in, refresh, persistence); Convex verifies
 * the Supabase access token server-side via the `customJwt` provider in
 * `src/convex/auth.config.ts`. This hook simply hands the current access
 * token to Convex when it needs one — the client is the bridge between the
 * two services.
 */
export function useSupabaseAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsLoading(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => subscription.unsubscribe();
  }, []);

  return useMemo(
    () => ({
      isLoading,
      isAuthenticated: !!session,
      fetchAccessToken: async ({
        forceRefreshToken,
      }: {
        forceRefreshToken: boolean;
      }): Promise<string | null> => {
        if (!supabase) return null;
        if (forceRefreshToken) {
          const { data } = await supabase.auth.refreshSession();
          return data.session?.access_token ?? null;
        }
        return session?.access_token ?? null;
      },
    }),
    [session, isLoading],
  );
}
