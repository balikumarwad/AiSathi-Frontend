/**
 * Seed a test account: auth user + रू500 topup + one API key.
 * Usage: node scripts/seed-test.mjs
 * Prints the plaintext API key ONCE — this is a test account.
 */

import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "crypto";
import { readFileSync } from "fs";

// Minimal .env.local loader (no dotenv dep in this repo).
const env = Object.fromEntries(
  readFileSync(".env.local", "utf-8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const EMAIL = "test@nepalai.local";

// 1) user (idempotent: reuse if exists)
let userId;
const { data: created, error: cErr } = await db.auth.admin.createUser({
  email: EMAIL,
  email_confirm: true,
});
if (created?.user) {
  userId = created.user.id;
  console.log("created user:", userId);
} else {
  const { data: list } = await db.auth.admin.listUsers();
  const existing = list?.users?.find((u) => u.email === EMAIL);
  if (!existing) throw new Error("createUser failed: " + cErr?.message);
  userId = existing.id;
  console.log("reusing user:", userId);
}

// 2) topup रू500
const { error: tErr } = await db.from("credit_transactions").insert({
  user_id: userId,
  amount_npr: 500,
  kind: "topup",
  meta: { note: "seed test topup" },
});
if (tErr) throw new Error("topup failed: " + tErr.message);

// 3) API key
const key = "np-" + randomBytes(32).toString("base64url");
const { error: kErr } = await db.from("api_keys").insert({
  user_id: userId,
  name: "test",
  key_hash: createHash("sha256").update(key).digest("hex"),
  key_prefix: key.slice(0, 10),
});
if (kErr) throw new Error("key insert failed: " + kErr.message);

const { data: bal } = await db.rpc("credit_balance", { p_user: userId });
console.log("balance_npr:", bal);
console.log("API KEY (save it):", key);
