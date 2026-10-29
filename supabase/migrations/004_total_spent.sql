-- Dashboard helper: lifetime spend for a user (successful calls only).
create or replace function total_spent(p_user uuid)
returns numeric
language sql stable security definer
set search_path = public
as $$
  select coalesce(sum(cost_npr), 0) from usage_log
  where user_id = p_user and status = 'ok';
$$;
