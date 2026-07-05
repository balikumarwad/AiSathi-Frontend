/**
 * API key format: np-<43 chars base64url>  (256 bits of entropy).
 * We store only sha256(key); the plaintext is shown once at creation.
 */

import { createHash, randomBytes } from "crypto";

export function generateApiKey(): { key: string; hash: string; prefix: string } {
  const key = "np-" + randomBytes(32).toString("base64url");
  return { key, hash: hashApiKey(key), prefix: key.slice(0, 10) };
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function bearerFrom(req: Request): string | null {
  const h = req.headers.get("authorization") ?? "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}
