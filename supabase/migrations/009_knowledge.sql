-- Nepal knowledge base for RAG. Curated, verified facts embedded with
-- text-embedding-3-small (1536 dims) via OpenRouter. Service-role only;
-- retrieval goes through /api/knowledge/search -> match_knowledge().
-- NOTE: deliberately NO ivfflat/hnsw index — the table is small (tens to
-- hundreds of rows) and exact scan gives perfect recall; approximate indexes
-- with default probes silently missed obvious matches. Revisit only past ~10k rows.
create extension if not exists vector;

create table if not exists public.knowledge (
  id bigint generated always as identity primary key,
  topic text not null,
  title text not null,
  content text not null,
  source text,
  as_of date,
  embedding vector(1536),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.knowledge enable row level security;
-- No public policies: reads go through the API route with the service role.

create or replace function public.match_knowledge(
  query_embedding vector(1536),
  match_count int default 3,
  min_similarity float default 0.3
) returns table (id bigint, topic text, title text, content text, source text, as_of date, similarity float)
language sql stable as $$
  select k.id, k.topic, k.title, k.content, k.source, k.as_of,
         1 - (k.embedding <=> query_embedding) as similarity
  from public.knowledge k
  where k.embedding is not null
    and 1 - (k.embedding <=> query_embedding) >= min_similarity
  order by k.embedding <=> query_embedding
  limit match_count;
$$;
