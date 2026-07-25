import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import path from "path";

// Load env for standalone scripts (Next.js loads these itself for the app).
config({ path: path.join(process.cwd(), ".env.local") });
config({ path: path.join(process.cwd(), ".env") });

export type { PersonInput } from "../lib/schemas";
export { PersonInputSchema } from "../lib/schemas";

/**
 * Admin client using the service-role key — scripts only, never the app.
 * Returns null when Supabase isn't configured.
 */
export function createAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}

export function requireAdminClient(): SupabaseClient {
  const client = createAdminClient();
  if (!client) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local"
    );
    process.exit(1);
  }
  return client;
}
