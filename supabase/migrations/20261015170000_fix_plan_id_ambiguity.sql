-- Fix ambiguous plan_id in follow_group_plan and record_plan_read.
-- The local variable shared its name with the group_plan_follows / group_plan_reads
-- column, so the insert ... on conflict (plan_id, ...) raised 42702 at runtime.

create or replace function private.follow_group_plan(target_group uuid, follow_mode text, local_day date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  found_plan uuid;
begin
  if uid is null then
    return jsonb_build_object('error', 'Sign in to join a plan.');
  end if;

  if follow_mode not in ('group', 'start') then
    return jsonb_build_object('error', 'Choose how you want to start.');
  end if;

  if local_day is null or local_day < (current_date - 1) or local_day > (current_date + 1) then
    return jsonb_build_object('error', 'That day is outside this reading.');
  end if;

  if not private.in_group(target_group) then
    return jsonb_build_object('error', 'Join the group before its plan.');
  end if;

  select id into found_plan from public.group_plans where group_id = target_group;
  if found_plan is null then
    return jsonb_build_object('error', 'This group has no plan.');
  end if;

  insert into public.group_plan_follows (plan_id, user_id, mode, started_on)
  values (found_plan, uid, follow_mode, local_day)
  on conflict (plan_id, user_id) do update
    set mode = excluded.mode,
        started_on = excluded.started_on;

  return jsonb_build_object('ok', true, 'id', found_plan, 'mode', follow_mode);
end;
$$;

create or replace function private.record_plan_read(target_group uuid, local_day date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  found_plan uuid;
begin
  if uid is null then
    return jsonb_build_object('error', 'Sign in to record a plan read.');
  end if;

  if local_day is null or local_day < (current_date - 1) or local_day > (current_date + 1) then
    return jsonb_build_object('error', 'That day is outside this reading.');
  end if;

  select plan.id into found_plan
  from public.group_plans as plan
  join public.group_plan_follows as follow
    on follow.plan_id = plan.id
   and follow.user_id = uid
  where plan.group_id = target_group;

  if found_plan is null then
    return jsonb_build_object('error', 'Join the plan before it counts.');
  end if;

  insert into public.group_plan_reads (plan_id, user_id, day)
  values (found_plan, uid, local_day)
  on conflict (plan_id, user_id, day) do nothing;

  return jsonb_build_object('ok', true);
end;
$$;
