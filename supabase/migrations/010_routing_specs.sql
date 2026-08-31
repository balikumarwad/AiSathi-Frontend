-- modelSpecs-style routing table. Which model serves which kind of request,
-- decided in the database so routing can be retuned with a SQL update instead
-- of a redeploy. Served to the client at GET /api/v1/models/routing.
--
-- This table was created directly in production on 2026-07-25 and had no
-- migration until now, so a fresh setup came up without it and Smart mode
-- silently fell back to the built-in pair. Reconstructed here from the live
-- production schema and seed rows.
--
-- How a request is matched: specs are tried highest `priority` first; the
-- first whose `match_regex` hits the user's text wins. `simple` has a null
-- regex and priority 0, so it is the catch-all. A user whose NPR balance is
-- at least `min_balance_npr` gets `premium_models`; everyone else is served
-- by the first model matching `free_patterns`.

create table if not exists public.routing_specs (
  task            text primary key,
  priority        integer     not null default 0,
  match_regex     text,                              -- JS-flavour regex, null = always matches
  min_balance_npr numeric     not null default 0,    -- NPR needed to reach premium_models
  premium_models  text[]      not null default '{}',
  free_patterns   text[]      not null default '{}', -- regexes matched against the free catalogue
  enabled         boolean     not null default true,
  updated_at      timestamptz not null default now()
);

alter table public.routing_specs enable row level security;

-- The routing table is public configuration, not user data: the client reads
-- it directly to decide which model to request. Writes are service-role only.
drop policy if exists "routing specs are public" on public.routing_specs;
create policy "routing specs are public"
  on public.routing_specs for select using (true);

-- ============================================================
-- Seed: mirrors production as of 2026-08-30.
-- ============================================================
insert into public.routing_specs
  (task, priority, match_regex, min_balance_npr, premium_models, free_patterns, enabled)
values
  (
    'coding', 30,
    '```|\bfunction\b|\bclass \b|\bimport \b|\bdef |=>|\bsql\b|\bregex\b|stack ?trace|traceback|refactor|\bdebug\b|algorithm|data structure',
    10,
    array['anthropic/claude-sonnet-5','openai/gpt-4o-mini'],
    array['gpt-oss-120b','qwen.*coder|qwen','llama-3\.3-70b','gemma-4','mistral'],
    true
  ),
  (
    'reasoning', 20,
    'architecture|system design|design an?|optimi[sz]e|business plan|financial|market analysis|\bstrategy\b|\bprove\b|theorem|derive|analy[sz]e|\bresearch\b|\bessay\b|dissertation|comprehensive|in detail|step[- ]by[- ]step',
    10,
    array['anthropic/claude-sonnet-5','openai/gpt-4o-mini'],
    array['gpt-oss-120b','gemma-4','llama-3\.3-70b','qwen','mistral','nemotron'],
    true
  ),
  (
    -- Six or more Devanagari characters in a row: reliably Nepali, and short
    -- enough not to trip on a single borrowed word in an English sentence.
    'nepali', 15,
    '[ऀ-ॿ]{6,}',
    5,
    array['openai/gpt-4o-mini'],
    array['gemma-4','gpt-oss-120b','llama-3\.3-70b','qwen'],
    true
  ),
  (
    -- Catch-all. Null regex, lowest priority, no balance required.
    'simple', 0,
    null,
    0,
    array[]::text[],
    array['gpt-oss-120b','gemma-4','llama-3\.3-70b','qwen','mistral','nemotron'],
    true
  )
on conflict (task) do nothing;
