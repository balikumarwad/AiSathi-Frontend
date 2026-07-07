-- Persistent per-user memory (ChatGPT/Claude-style). Short durable facts the
-- assistant remembers across conversations. Owner-only RLS.

create table if not exists user_memories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  content     text not null,
  created_at  timestamptz not null default now()
);
create index if not exists user_memories_user_idx on user_memories(user_id, created_at);

alter table user_memories enable row level security;

create policy "own memories select" on user_memories for select using (auth.uid() = user_id);
create policy "own memories insert" on user_memories for insert with check (auth.uid() = user_id);
create policy "own memories delete" on user_memories for delete using (auth.uid() = user_id);
