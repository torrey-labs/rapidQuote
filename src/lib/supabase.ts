import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "./config";

let cachedServer: SupabaseClient | null = null;

/**
 * Server-side Supabase client. Uses the service role key and bypasses RLS.
 * Only call from route handlers / server components / server utilities —
 * NEVER from a client component or page that might hydrate in the browser.
 */
export function getSupabaseServer(): SupabaseClient {
  if (!cachedServer) {
    cachedServer = createClient(
      config.supabase.url(),
      config.supabase.serviceKey(),
      {
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );
  }
  return cachedServer;
}
