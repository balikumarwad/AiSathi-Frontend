-- Khalti top-up payments.
-- One row per initiated payment; pidx is Khalti's unique payment id and our
-- idempotency guard — a payment can be credited to the ledger exactly once.

create table if not exists payments (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  provider     text not null default 'khalti',
  pidx         text not null unique,        -- Khalti payment index
  amount_npr   numeric(12,2) not null check (amount_npr > 0),
  status       text not null default 'pending'
               check (status in ('pending','completed','failed','expired')),
  meta         jsonb not null default '{}',
  created_at   timestamptz not null default now(),
  verified_at  timestamptz
);
create index if not exists payments_user_idx on payments(user_id, created_at desc);

alter table payments enable row level security;
create policy "own payments" on payments for select using (auth.uid() = user_id);
-- writes happen only through the service role.
