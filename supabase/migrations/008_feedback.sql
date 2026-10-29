-- Reply feedback (thumbs up/down). Written only by the API route via the
-- service role; each signed-in vote doubles as a lucky-draw entry. This data
-- seeds the future RAG knowledge base and fine-tuning set.
create table if not exists public.feedback (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  api_key_id uuid,
  anonymous boolean not null default false,
  model text,
  question text,
  answer text,
  vote text not null check (vote in ('up','down')),
  chat_id text,
  msg_index int,
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;
-- No public policies: only the service role (API route) reads/writes.

create index if not exists feedback_user_idx on public.feedback (user_id, created_at desc);
create index if not exists feedback_vote_idx on public.feedback (vote, created_at desc);
