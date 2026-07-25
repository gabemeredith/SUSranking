import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Cookie-less anon-key client for public reads (leaderboard). Because it
 * carries no per-user state it can be used inside unstable_cache, letting
 * hot public pages be served from the Next.js data cache instead of hitting
 * Postgres on every request.
 */
export function createAnonClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
