/**
 * API key management for logged-in users (Supabase JWT auth).
 *
 *   POST   { name? }      -> create a key; plaintext returned ONCE
 *   GET                   -> list your keys (prefix only, never plaintext)
 *   DELETE { id }         -> revoke (soft: active=false)
 *
 * Auth: Authorization: Bearer <supabase access token> — the token users get
 * from Supabase email/OTP login. (Login UI is a later phase; until then keys
 * can be minted with the service role via SQL or this route from a session.)
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { bearerFrom, generateApiKey } from "@/lib/keys";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

async function userFromJwt(req: Request): Promise<{ id: string } | null> {
  const token = bearerFrom(req);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !url || !anon) return null;
  const client = createClient(url, anon, { auth: { persistSession: false } });
  const { data } = await client.auth.getUser(token);
  return data.user ? { id: data.user.id } : null;
}

function unauthorized() {
  return NextResponse.json(
    { error: { message: "Sign in required (Supabase access token)", code: 401 } },
    { status: 401 },
  );
}

export async function POST(req: Request) {
  const user = await userFromJwt(req);
  const db = supabaseAdmin();
  if (!user || !db) return unauthorized();

  // Cap key sprawl: max 10 active keys per account. (The playground's
  // auto-minted "chat" keys land here too.)
  const { count } = await db
    .from("api_keys")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("active", true);
  if ((count ?? 0) >= 10) {
    return NextResponse.json(
      { error: { message: "Key limit reached (10 active). Revoke an old key on your account page first.", code: 429 } },
      { status: 429 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const { key, hash, prefix } = generateApiKey();
  const { error } = await db.from("api_keys").insert({
    user_id: user.id,
    name: String(body.name ?? "default").slice(0, 60),
    key_hash: hash,
    key_prefix: prefix,
  });
  if (error) {
    return NextResponse.json(
      { error: { message: "Could not create key", code: 500 } },
      { status: 500 },
    );
  }
  // The only time the plaintext key ever leaves the server.
  return NextResponse.json({ key, prefix, note: "Store this now — it is not shown again." });
}

export async function GET(req: Request) {
  const user = await userFromJwt(req);
  const db = supabaseAdmin();
  if (!user || !db) return unauthorized();

  const { data } = await db
    .from("api_keys")
    .select("id, name, key_prefix, active, created_at, last_used_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  return NextResponse.json({ data: data ?? [] });
}

export async function DELETE(req: Request) {
  const user = await userFromJwt(req);
  const db = supabaseAdmin();
  if (!user || !db) return unauthorized();

  const body = await req.json().catch(() => ({}));
  if (!body.id) {
    return NextResponse.json(
      { error: { message: "`id` is required", code: 400 } },
      { status: 400 },
    );
  }
  const { error } = await db
    .from("api_keys")
    .update({ active: false })
    .eq("id", body.id)
    .eq("user_id", user.id); // can only revoke your own keys
  if (error) {
    return NextResponse.json(
      { error: { message: "Could not revoke key", code: 500 } },
      { status: 500 },
    );
  }
  return NextResponse.json({ revoked: body.id });
}
