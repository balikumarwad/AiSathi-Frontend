/**
 * Full data backup: auth users + every public table -> timestamped JSON.
 * Run before any credential reset or risky change:  node scripts/backup.mjs
 * Output: backups/aisathi-backup-<iso>.json  (backups/ is gitignored — it
 * contains personal data; store copies somewhere safe, not in the repo).
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, mkdirSync, writeFileSync } from "fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf-8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const TABLES = ["api_keys", "credit_transactions", "usage_log", "payments", "plans"];

const backup = { created_at: new Date().toISOString(), project: env.NEXT_PUBLIC_SUPABASE_URL };

// auth users (paginated)
backup.auth_users = [];
for (let page = 1; ; page++) {
  const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) throw error;
  backup.auth_users.push(...data.users);
  if (data.users.length < 1000) break;
}

for (const t of TABLES) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(t).select("*").range(from, from + 999);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 1000) break;
  }
  backup[t] = rows;
}

mkdirSync("backups", { recursive: true });
const file = `backups/aisathi-backup-${backup.created_at.replace(/[:.]/g, "-")}.json`;
writeFileSync(file, JSON.stringify(backup, null, 2));
console.log("backup written:", file);
console.log(
  "  users:", backup.auth_users.length,
  "| ledger rows:", backup.credit_transactions.length,
  "| usage rows:", backup.usage_log.length,
  "| keys:", backup.api_keys.length,
  "| payments:", backup.payments.length,
);
