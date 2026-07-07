-- Public, read-only shared conversations (viral-growth share links).
-- A signed-in user publishes a snapshot of a chat; anyone with the
-- unguessable slug can read it. The slug is the access gate, so SELECT is
-- open to all; writes are owner-only.

create table if not exists shared_chats (
  id          text primary key,          -- random unguessable slug
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null default 'Shared chat',
  messages    jsonb not null default '[]',
  created_at  timestamptz not null default now()
);
create index if not exists shared_chats_user_idx on shared_chats(user_id, created_at desc);

alter table shared_chats enable row level security;

-- Anyone (including anonymous visitors) can read a share by its slug.
create policy "public read shares" on shared_chats for select using (true);
-- Only the owner can create or delete their own shares.
create policy "own share insert" on shared_chats for insert with check (auth.uid() = user_id);
create policy "own share delete" on shared_chats for delete using (auth.uid() = user_id);
