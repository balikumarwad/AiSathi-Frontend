-- NepalAI gateway schema
-- Paste into the Supabase SQL editor (or run via supabase db push).

-- ============================================================
-- API keys: we store ONLY a sha256 hash of the key, never the key.
-- ============================================================
create table if not exists api_keys (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null default 'default',
  key_hash    text not null unique,          -- sha256 hex of the full key
  key_prefix  text not null,                 -- first 10 chars, for display only
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  last_used_at timestamptz
);
create index if not exists api_keys_user_idx on api_keys(user_id);

-- ============================================================
-- Credit ledger (NPR). Balance = sum(amount_npr). Append-only.
--   topup    : +N  (eSewa/Khalti verified payment)
--   usage    : -N  (metered API call)
--   adjust   : +/- (manual admin correction / promo)
-- ============================================================
create table if not exists credit_transactions (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  amount_npr  numeric(12,4) not null,
  kind        text not null check (kind in ('topup','usage','adjust')),
  meta        jsonb not null default '{}',
  created_at  timestamptz not null default now()
);
create index if not exists credit_tx_user_idx on credit_transactions(user_id, created_at desc);

-- ============================================================
-- Usage log: one row per gateway request (observability + billing audit).
-- ============================================================
create table if not exists usage_log (
  id                bigint generated always as identity primary key,
  user_id           uuid not null references auth.users(id) on delete cascade,
  api_key_id        uuid references api_keys(id) on delete set null,
  model             text not null,
  prompt_tokens     integer not null default 0,
  completion_tokens integer not null default 0,
  upstream_cost_usd numeric(12,8) not null default 0,
  cost_npr          numeric(12,4) not null default 0,
  status            text not null default 'ok',   -- ok | upstream_error | insufficient_credits
  created_at        timestamptz not null default now()
);
create index if not exists usage_log_user_idx on usage_log(user_id, created_at desc);

-- ============================================================
-- Balance helper
-- ============================================================
create or replace function credit_balance(p_user uuid)
returns numeric language sql stable as $$
  select coalesce(sum(amount_npr), 0) from credit_transactions where user_id = p_user;
$$;

-- ============================================================
-- Atomic usage deduction: locks the user's ledger rows, re-checks the
-- balance, then appends the usage row. Returns the new balance or raises.
-- ============================================================
create or replace function deduct_credits(p_user uuid, p_amount_npr numeric, p_meta jsonb default '{}')
returns numeric language plpgsql as $$
declare
  bal numeric;
begin
  -- serialize concurrent deductions per user
  perform pg_advisory_xact_lock(hashtext(p_user::text));
  bal := credit_balance(p_user);
  if bal < p_amount_npr then
    raise exception 'insufficient_credits: balance % < cost %', bal, p_amount_npr;
  end if;
  insert into credit_transactions(user_id, amount_npr, kind, meta)
  values (p_user, -p_amount_npr, 'usage', p_meta);
  return bal - p_amount_npr;
end;
$$;

-- ============================================================
-- RLS: users can read their own rows; only the service role writes.
-- ============================================================
alter table api_keys            enable row level security;
alter table credit_transactions enable row level security;
alter table usage_log           enable row level security;

create policy "own api keys"  on api_keys            for select using (auth.uid() = user_id);
create policy "own ledger"    on credit_transactions for select using (auth.uid() = user_id);
create policy "own usage"     on usage_log           for select using (auth.uid() = user_id);
-- inserts/updates happen only through the service-role key (bypasses RLS).
