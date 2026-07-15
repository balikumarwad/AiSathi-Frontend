/**
 * Instant email signup — creates a pre-confirmed account so the user is logged
 * in immediately, with no email round-trip. This is what makes signup work
 * inside in-app browsers (LinkedIn, Facebook, Instagram…), where Google OAuth
 * is blocked and the "click the link in your email" flow opens a *different*
 * browser and loses the session.
 *
 * Google signups stay the verified default; only password signups are
 * auto-confirmed here. Free tier only, so abuse is bounded by the usual limits.
 */

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { allowAsync } from "@/lib/ratelimit";

export const runtime = "nodejs";

function clientIp(req: Request): string {
  return (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
}

export async function POST(req: Request) {
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ error: "Signup isn't configured." }, { status: 503 });

  // Cap account creation per IP so this can't be scripted into a spam factory.
  if (!(await allowAsync(`signup:${clientIp(req)}`, 5, 60 * 60 * 1000))) {
    return NextResponse.json({ error: "Too many signups from here. Try again later." }, { status: 429 });
  }

  const body = (await req.json().catch(() => null)) as
    | { email?: string; password?: string; name?: string; address?: string }
    | null;
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
  }

  const { error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // pre-confirmed: log in immediately, no email link
    user_metadata: {
      full_name: String(body?.name ?? "").trim().slice(0, 120) || null,
      address: String(body?.address ?? "").trim().slice(0, 240) || null,
    },
  });
  if (error) {
    const msg = /already/i.test(error.message)
      ? "An account with this email already exists — sign in instead."
      : error.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
