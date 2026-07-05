-- Dual-market billing (spec v1.0): plans table + gateway-agnostic payments.
-- Ledger stays NPR-denominated (decision 2026-07-05): plans grant a fixed NPR
-- balance; the same tier grants the same NPR both markets, intl pays more
-- (covers Stripe fees + margin). Amounts are ALWAYS read server-side from
-- plans — the client sends only a plan_id (or a bounded custom topup amount).

-- ============================================================
-- plans — market-specific pricing (spec §2.3, adapted to NPR credit)
-- ============================================================
create table if not exists plans (
  id           text primary key,             -- 'starter_np', 'starter_intl', ...
  market       text not null check (market in ('intl','np')),
  display_name text not null,
  currency     text not null check (currency in ('USD','AUD','NPR')),
  price        numeric(12,2) not null,       -- what the user pays, in `currency`
  credit_npr   numeric(12,2) not null,       -- NPR balance granted on success
  active       boolean not null default true
);

insert into plans (id, market, display_name, currency, price, credit_npr) values
  ('starter_np',   'np',   'Starter (Nepal)',         'NPR',  499.00,  499.00),
  ('pro_np',       'np',   'Pro (Nepal)',             'NPR', 1199.00, 1199.00),
  ('starter_intl', 'intl', 'Starter (International)', 'USD',   10.00,  499.00),
  ('pro_intl',     'intl', 'Pro (International)',     'USD',   25.00, 1199.00)
on conflict (id) do nothing;

alter table plans enable row level security;
create policy "plans are public" on plans for select using (true);

-- ============================================================
-- payments — upgrade to gateway-agnostic shape (spec §2.1).
-- Existing khalti columns (pidx) are kept; new columns cover Stripe/eSewa.
-- ============================================================
alter table payments
  add column if not exists gateway        text not null default 'khalti'
    check (gateway in ('stripe','khalti','esewa')),
  add column if not exists gateway_txn_id text,          -- Stripe PI / Khalti pidx / eSewa ref
  add column if not exists currency       text not null default 'NPR'
    check (currency in ('USD','AUD','NPR')),
  add column if not exists amount         numeric(12,2), -- amount in `currency`
  add column if not exists credit_npr     numeric(12,2), -- NPR to credit on success
  add column if not exists plan_id        text references plans(id),
  add column if not exists raw_response   jsonb;

-- provider column predates gateway; keep them in sync for old rows.
update payments set gateway = provider where gateway is distinct from provider
  and provider in ('stripe','khalti','esewa');
update payments set gateway_txn_id = pidx where gateway_txn_id is null;
update payments set amount = amount_npr where amount is null;
update payments set credit_npr = amount_npr where credit_npr is null;

-- Idempotency guard across all gateways (spec §2.1).
create unique index if not exists payments_gateway_txn_uidx
  on payments (gateway, gateway_txn_id) where gateway_txn_id is not null;

-- Extend status vocabulary with 'refunded' (spec) alongside existing values.
alter table payments drop constraint if exists payments_status_check;
alter table payments add constraint payments_status_check
  check (status in ('pending','completed','failed','expired','refunded'));
