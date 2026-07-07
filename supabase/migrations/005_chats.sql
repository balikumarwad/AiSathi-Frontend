-- Server-synced playground chats (ChatGPT/Claude-style cross-device history).
-- One row per chat, messages as JSONB mirroring the client shape. The browser
-- talks to this table directly with the anon key; RLS scopes every operation
-- to the signed-in user. Images are stripped client-side before upload.

create table if not exists chats (
  id          text not null,                 -- client-generated id
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null default 'New chat',
  messages    jsonb not null default '[]',
  updated_at  timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists chats_user_updated_idx on chats(user_id, updated_at desc);

alter table chats enable row level security;

create policy "own chats select" on chats for select using (auth.uid() = user_id);
create policy "own chats insert" on chats for insert with check (auth.uid() = user_id);
create policy "own chats update" on chats for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own chats delete" on chats for delete using (auth.uid() = user_id);
