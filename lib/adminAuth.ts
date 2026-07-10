/**
 * Admin gate for /api/admin/* — verifies the Supabase access token and checks
 * the email against NEPALAI_ADMIN_EMAILS (comma-separated; defaults to the
 * founder's email).
 */

import { createClient } from "@supabase/supabase-js";
import { bearerFrom } from "@/lib/keys";

export function adminEmails(): string[] {
  return (process.env.NEPALAI_ADMIN_EMAILS ?? "neupaneoscar143@gmail.com")
    .split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
}

export async function requireAdmin(req: Request): Promise<{ email: string } | null> {
  const token = bearerFrom(req);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !url || !anon) return null;
  const client = createClient(url, anon, { auth: { persistSession: false } });
  const { data } = await client.auth.getUser(token);
  const email = data.user?.email?.toLowerCase();
  return email && adminEmails().includes(email) ? { email } : null;
}
