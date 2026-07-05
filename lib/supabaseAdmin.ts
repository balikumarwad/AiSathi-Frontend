/**
 * Service-role Supabase client (server only — bypasses RLS).
 * Returns null when Supabase isn't configured yet, so the gateway can still
 * run in dev-key mode before the database exists.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null | undefined;

export function supabaseAdmin(): SupabaseClient | null {
  if (cached !== undefined) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  cached = url && serviceKey
    ? createClient(url, serviceKey, { auth: { persistSession: false } })
    : null;
  return cached;
}
