/**
 * Credential filter (LibreChat messageFilter.pii pattern): reject chat
 * messages that contain API-key-shaped secrets BEFORE they reach the upstream
 * model or our logs. Protects users who paste keys by accident — the same
 * class of leak that has bitten this project itself.
 *
 * Patterns are deliberately conservative (long random tails required) so
 * normal prose and code tutorials don't false-positive.
 */

const PATTERNS: Array<{ label: string; re: RegExp }> = [
  // OpenAI / Anthropic / OpenRouter style keys (sk-, sk-ant-, sk-or-, sk_live_ …)
  { label: "API key (sk-…)", re: /\bsk[-_][A-Za-z0-9_-]{18,}\b/ },
  // AIsathi's own gateway keys — never let users paste these into a chat.
  { label: "AIsathi API key (np-…)", re: /\bnp-[A-Za-z0-9_-]{38,}\b/ },
  // Authorization: Bearer <long token>
  { label: "Bearer token", re: /\bBearer\s+[A-Za-z0-9._~+/=-]{25,}\b/i },
  // GitHub personal access tokens
  { label: "GitHub token", re: /\bgh[pousr]_[A-Za-z0-9]{30,}\b/ },
  // Explicit api_key/apikey/secret assignments with a long random value
  { label: "API key assignment", re: /\bapi[_-]?key["'\s:=]{1,4}[A-Za-z0-9_-]{25,}\b/i },
];

/** Returns a human label of the first credential-shaped match, or null. */
export function findCredential(text: string): string | null {
  for (const p of PATTERNS) {
    if (p.re.test(text)) return p.label;
  }
  return null;
}
