# SathiAI — the OpenRouter of Nepal

One API for hundreds of AI models. **Pay in NPR** with eSewa/Khalti — no USD
card, no foreign billing. OpenAI-compatible: point any SDK at our base URL and
it just works.

```
developer ──► SathiAI gateway ──► OpenRouter (upstream, USD)
                  │
                  ├─ auth: np-… API key (sha256-hashed at rest)
                  ├─ meter: tokens → USD cost → NPR (× FX × margin)
                  ├─ ledger: append-only NPR credits, atomic deduction
                  └─ log: usage_log (Supabase Postgres)
```

## API

| Endpoint | Auth | What |
|---|---|---|
| `POST /api/v1/chat/completions` | `Bearer np-…` | OpenAI-compatible chat; response includes `nepalai: { cost_npr, balance_npr }` |
| `GET /api/v1/models` | none | model catalog, prices in NPR per million tokens |
| `GET /api/v1/me` | `Bearer np-…` | balance + recent usage for the key's account |
| `POST/GET/DELETE /api/keys` | Supabase JWT | create / list / revoke API keys |

Example:

```bash
curl http://localhost:3000/api/v1/chat/completions \
  -H "Authorization: Bearer np-your-key" \
  -H "Content-Type: application/json" \
  -d '{"model":"openai/gpt-4o-mini","messages":[{"role":"user","content":"नमस्ते!"}]}'
```

## Pages

`/` landing · `/models` NPR-priced catalog · `/playground` chat that calls the
public gateway (dogfooding) · `/dashboard` paste a key → balance + usage.

## Setup

```bash
npm install
cp .env.example .env.local     # then fill in:
```

1. **`OPENROUTER_API_KEY`** — the upstream key (we pay this side in USD).
2. **Supabase** — create/open your project, run
   `supabase/migrations/001_init.sql` in the SQL editor, then paste
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY` into `.env.local`.
3. **`NEPALAI_DEV_KEY`** — any string; lets you call the gateway *before*
   Supabase is wired (unlimited, not metered to a ledger). Remove in prod.
4. Pricing knobs: `NEPALAI_FX_NPR_PER_USD` (default 140),
   `NEPALAI_MARGIN` (default 1.25 — must cover FX drift + payment fees).

```bash
npm run dev          # http://localhost:3000
npm run build        # production build
```

### Seeding a test account (until the login UI ships)

In the Supabase SQL editor:

```sql
-- 1. create a user in Auth → Users (or use an existing one), then:
insert into credit_transactions (user_id, amount_npr, kind, meta)
values ('<user-uuid>', 500, 'topup', '{"note":"test topup"}');
```

Create a key for that user by calling `POST /api/keys` with their Supabase
access token, or insert a hash directly (see `lib/keys.ts` for the format).

## Design decisions

- **Non-streaming MVP** — metering is trivially correct; SSE relay with
  usage-in-final-chunk is the next phase.
- **Keys are never stored in plaintext** — sha256 only; shown once at creation.
- **Ledger is append-only** — balance is `sum(amount_npr)`; deduction happens
  in a Postgres function under an advisory lock, so concurrent requests can't
  double-spend.
- **Upstream failures are never charged** — logged with `status: upstream_error`.

## Roadmap

1. Khalti top-up (sandbox → live) → eSewa
2. Streaming responses
3. Supabase auth UI (email/OTP) — self-serve keys
4. Rate limiting per key
5. Admin panel (adjustments, FX/margin without redeploy)
