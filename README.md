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
| `POST /api/v1/chat/completions` | `Bearer np-…` | OpenAI-compatible chat, streaming and non-streaming; response includes `nepalai: { cost_npr, balance_npr }` |
| `GET /api/v1/chat/stream/[id]` | `Bearer np-…` | resume a stream whose connection dropped mid-answer |
| `GET /api/v1/models` | none | model catalog, prices in NPR per million tokens |
| `GET /api/v1/models/routing` | none | the routing table — which model serves which task, edited in the DB, no redeploy |
| `GET /api/v1/me` | `Bearer np-…` | balance + recent usage for the key's account |
| `GET /api/v1/plans` | none | plan catalog |
| `POST /api/v1/tts` | `Bearer np-…` | Pro voice. Returns `503` until `TTS_API_KEY` is set; 60 calls/day per user |
| `POST /api/keys` · `GET` · `DELETE` | Supabase JWT | create / list / revoke API keys |

Beyond the public gateway there are internal routes the app itself uses —
`api/signup`, `api/account/usage`, `api/knowledge/search` (RAG over pgvector),
`api/feedback`, `api/images`, `api/topup/{initiate,verify}` (Khalti),
`api/stripe/{checkout,webhook}`, `api/cron/{reconcile,refill}` and
`api/admin/{metrics,feedback,draw}`. Read the route file before changing one;
several of them move money.

Example:

```bash
curl http://localhost:3000/api/v1/chat/completions \
  -H "Authorization: Bearer np-your-key" \
  -H "Content-Type: application/json" \
  -d '{"model":"openai/gpt-4o-mini","messages":[{"role":"user","content":"नमस्ते!"}]}'
```

## Pages

`/` landing · `/app` the product · `/playground` chat that calls the public
gateway (dogfooding) · `/models` NPR-priced catalog · `/dashboard` balance +
usage · `/account` · `/topup` Khalti and Stripe · `/login` · `/docs` ·
`/admin` · `/share/[id]` public snapshot of a chat · `/privacy` · `/terms`.

## Setup

```bash
npm install
cp .env.example .env.local     # then fill in:
```

1. **`OPENROUTER_API_KEY`** — the upstream key (we pay this side in USD).
2. **Supabase** — create your own free project (do not point a dev machine at
   production), then run **every file in `supabase/migrations/` in numerical
   order** in the SQL editor — `001_init.sql` through `009_knowledge.sql`.
   Running only `001` leaves you on the first-week schema with no chats,
   payments or knowledge tables, and everything after it fails in ways that
   look like application bugs. Then paste `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` into
   `.env.local` — all three come from *your* project, Settings → API.
3. **`NEPALAI_DEV_KEY`** — any string; lets you call the gateway *before*
   Supabase is wired (unlimited, not metered to a ledger). Remove in prod.
4. Pricing knobs: `NEPALAI_FX_NPR_PER_USD` (default 140),
   `NEPALAI_MARGIN` (default 1.25 — must cover FX drift + payment fees).

```bash
npm run dev          # http://localhost:3000
npm run build        # production build
```

### Seeding a test account

Sign-up works (`/login`, `api/signup`), so you can just make an account. This
is the shortcut when you want credit on it without going through a payment.

In the Supabase SQL editor:

```sql
-- 1. create a user in Auth → Users (or use an existing one), then:
insert into credit_transactions (user_id, amount_npr, kind, meta)
values ('<user-uuid>', 500, 'topup', '{"note":"test topup"}');
```

Create a key for that user by calling `POST /api/keys` with their Supabase
access token, or insert a hash directly (see `lib/keys.ts` for the format).

## Design decisions

- **Streaming is resumable** — chunks are written to a stream store as they go,
  so a dropped connection can rejoin at `/api/v1/chat/stream/[id]` instead of
  losing the answer. The trade-off is that a streamed answer can't be un-sent,
  so the balance check happens up front rather than at the end.
- **Keys are never stored in plaintext** — sha256 only; shown once at creation.
- **API-key-shaped strings are blocked before they leave** — `lib/messageFilter.ts`
  rejects the turn if a message looks like it contains a live credential, so it
  never reaches the upstream provider or any log.
- **Which model serves which task lives in the database** — the `routing_specs`
  table, served at `/api/v1/models/routing`. Retuning routing is a SQL update,
  not a deploy.
- **Ledger is append-only** — balance is `sum(amount_npr)`; deduction happens
  in a Postgres function under an advisory lock, so concurrent requests can't
  double-spend.
- **Upstream failures are never charged** — logged with `status: upstream_error`.

## Already built

Streaming (resumable), auth and self-serve keys, per-key rate limiting
(`lib/ratelimit.ts`), the admin panel (`/admin`), Khalti and Stripe top-up,
RAG over pgvector with a relevance floor, full-text chat search, chat
branching and sharing, the credential filter, and the DB-driven routing table.
The old roadmap listed most of these as upcoming — it was a month out of date.

## What's actually left

Each of these is finished code waiting on a key or a decision, not work:

1. **Pro voice** — `/api/v1/tts` returns `503` until `TTS_API_KEY` is set.
   Needs an ElevenLabs (or OpenAI-compatible) account.
2. **Khalti in production** — `lib/khalti.ts` defaults to the sandbox at
   `dev.khalti.com`. Live needs a production secret key and
   `KHALTI_BASE_URL=https://khalti.com/api/v2`.
3. **Stripe in production** — live keys and a webhook secret.
4. **Auto-refill** — `api/cron/refill` returns `{ disabled: true }` until
   `REFILL_AMOUNT_NPR` is greater than zero. It grants real credit, so it is
   off by default on purpose.
5. **eSewa** — the landing copy mentions it; there is no integration. Khalti
   and Stripe are the two rails that exist.
