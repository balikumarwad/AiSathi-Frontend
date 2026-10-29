/**
 * Shared gateway auth: resolve a SathiAI `np-…` API key to its account.
 * Used by routes that act on behalf of a key's owner (topup, etc.).
 */

import { bearerFrom, hashApiKey } from "@/lib/keys";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type KeyAccount = { userId: string; keyId: string };

export async function accountFromApiKey(req: Request): Promise<KeyAccount | null> {
  const token = bearerFrom(req);
  const db = supabaseAdmin();
  if (!token || !db) return null;
  const { data } = await db
    .from("api_keys")
    .select("id, user_id, active")
    .eq("key_hash", hashApiKey(token))
    .maybeSingle();
  if (!data || !data.active) return null;
  return { userId: data.user_id, keyId: data.id };
}
