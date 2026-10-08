-- Group reading plans and opt-in shared notes.
-- One active plan per group. A shared note is the reflection text only.
-- Apply after 20261008023955_social_layer.sql. Do not apply from the app.

create table public.group_plans (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null unique references public.groups (id) on delete cascade,
  book_id text not null,
  start_chapter integer not null,
  end_chapter integer not null,
  pace text not null,
  reading_days integer not null,
  start_date date not null,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint group_plans_book check (book_id ~ '^[a-z0-9-]{1,32}$'),
  constraint group_plans_chapters check (
    start_chapter between 1 and 200
    and end_chapter between 1 and 200
    and end_chapter >= start_chapter
  ),
  constraint group_plans_pace check (pace in ('verses', 'chapter', 'two')),
  constraint group_plans_days check (reading_days between 1 and 127)
);

comment on table public.group_plans is
  'One active reading plan for a group. Pace matches the app drip size. Weekend bits can be off.';

create table public.group_plan_follows (
  plan_id uuid not null references public.group_plans (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  mode text not null,
  started_on date not null,
  primary key (plan_id, user_id),
  constraint group_plan_follows_mode check (mode in ('group', 'start'))
);

comment on table public.group_plan_follows is
  'mode group reads the shared calendar. mode start begins at day 1 on started_on.';

create table public.group_plan_reads (
  plan_id uuid not null references public.group_plans (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  primary key (plan_id, user_id, day)
);

comment on table public.group_plan_reads is
  'A finished plan drip. Groups with a plan count these, not a personal book read.';

create table public.shared_notes (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shared_notes_author_day unique (author_id, day),
  constraint shared_notes_body check (char_length(btrim(body)) between 1 and 500)
);

comment on table public.shared_notes is
  'Opt-in reflection text for one day. No answer, Not today, Huh?, or book.';

create table public.shared_note_groups (
  note_id uuid not null references public.shared_notes (id) on delete cascade,
  group_id uuid not null references public.groups (id) on delete cascade,
  primary key (note_id, group_id)
);

create table public.shared_note_partners (
  note_id uuid not null references public.shared_notes (id) on delete cascade,
  recipient_id uuid not null references auth.users (id) on delete cascade,
  primary key (note_id, recipient_id)
);

create index shared_note_groups_group_idx on public.shared_note_groups (group_id);
create index shared_note_partners_recipient_idx on public.shared_note_partners (recipient_id);

create or replace function private.can_read_note(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target is not null
    and auth.uid() is not null
    and (
      exists (
        select 1
        from public.shared_notes as note
        where note.id = target
          and note.author_id = auth.uid()
      )
      or exists (
        select 1
        from public.shared_note_groups as share
        join public.group_members as member
          on member.group_id = share.group_id
         and member.user_id = auth.uid()
        where share.note_id = target
      )
      or exists (
        select 1
        from public.shared_note_partners as share
        join public.shared_notes as note
          on note.id = share.note_id
        join public.partnerships as partnership
          on partnership.status = 'active'
         and partnership.user_low = least(note.author_id, share.recipient_id)
         and partnership.user_high = greatest(note.author_id, share.recipient_id)
        where share.note_id = target
          and share.recipient_id = auth.uid()
      )
    );
$$;

create or replace function private.set_group_plan(
  target_group uuid,
  book_id text,
  start_chapter integer,
  end_chapter integer,
  plan_pace text,
  reading_days integer,
  start_on date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  new_id uuid;
begin
  if uid is null then
    return jsonb_build_object('error', 'Sign in to set a plan.');
  end if;

  if not exists (
    select 1
    from public.groups as groups
    where groups.id = target_group
      and groups.owner_id = uid
  ) then
    return jsonb_build_object('error', 'Only the owner can set the plan.');
  end if;

  if book_id is null or book_id !~ '^[a-z0-9-]{1,32}$' then
    return jsonb_build_object('error', 'Choose a book.');
  end if;

  if start_chapter is null or end_chapter is null
    or start_chapter < 1 or end_chapter > 200 or end_chapter < start_chapter then
    return jsonb_build_object('error', 'Choose a chapter range inside the book.');
  end if;

  if plan_pace not in ('verses', 'chapter', 'two') then
    return jsonb_build_object('error', 'Choose a pace.');
  end if;

  if reading_days is null or reading_days < 1 or reading_days > 127 then
    return jsonb_build_object('error', 'Pick at least one reading day.');
  end if;

  if start_on is null then
    return jsonb_build_object('error', 'Choose a start date.');
  end if;

  delete from public.group_plans where group_id = target_group;

  insert into public.group_plans (
    group_id, book_id, start_chapter, end_chapter, pace, reading_days, start_date, created_by
  )
  values (target_group, book_id, start_chapter, end_chapter, plan_pace, reading_days, start_on, uid)
  returning id into new_id;

  return jsonb_build_object('ok', true, 'id', new_id);
end;
$$;

create or replace function private.end_group_plan(target_group uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  removed integer;
begin
  if uid is null then
    return jsonb_build_object('error', 'Sign in to end a plan.');
  end if;

  if not exists (
    select 1 from public.groups as groups
    where groups.id = target_group and groups.owner_id = uid
  ) then
    return jsonb_build_object('error', 'Only the owner can end the plan.');
  end if;

  delete from public.group_plans where group_id = target_group;
  get diagnostics removed = row_count;
  if removed = 0 then
    return jsonb_build_object('error', 'This group has no plan.');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function private.follow_group_plan(target_group uuid, follow_mode text, local_day date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  plan_id uuid;
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

  select id into plan_id from public.group_plans where group_id = target_group;
  if plan_id is null then
    return jsonb_build_object('error', 'This group has no plan.');
  end if;

  insert into public.group_plan_follows (plan_id, user_id, mode, started_on)
  values (plan_id, uid, follow_mode, local_day)
  on conflict (plan_id, user_id) do update
    set mode = excluded.mode,
        started_on = excluded.started_on;

  return jsonb_build_object('ok', true, 'id', plan_id, 'mode', follow_mode);
end;
$$;

create or replace function private.leave_group_plan(target_group uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    return jsonb_build_object('error', 'Sign in to leave a plan.');
  end if;

  delete from public.group_plan_follows as follow
  using public.group_plans as plan
  where follow.plan_id = plan.id
    and plan.group_id = target_group
    and follow.user_id = uid;

  return jsonb_build_object('ok', true);
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
  plan_id uuid;
begin
  if uid is null then
    return jsonb_build_object('error', 'Sign in to record a plan read.');
  end if;

  if local_day is null or local_day < (current_date - 1) or local_day > (current_date + 1) then
    return jsonb_build_object('error', 'That day is outside this reading.');
  end if;

  select plan.id into plan_id
  from public.group_plans as plan
  join public.group_plan_follows as follow
    on follow.plan_id = plan.id
   and follow.user_id = uid
  where plan.group_id = target_group;

  if plan_id is null then
    return jsonb_build_object('error', 'Join the plan before it counts.');
  end if;

  insert into public.group_plan_reads (plan_id, user_id, day)
  values (plan_id, uid, local_day)
  on conflict (plan_id, user_id, day) do nothing;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function private.share_note(
  local_day date,
  note_body text,
  group_ids uuid[],
  partner_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  cleaned text := btrim(coalesce(note_body, ''));
  kept uuid;
  gid uuid;
  pid uuid;
  seen uuid[] := '{}';
begin
  if uid is null then
    return jsonb_build_object('error', 'Sign in to share a note.');
  end if;

  if local_day is null or local_day < (current_date - 1) or local_day > (current_date + 1) then
    return jsonb_build_object('error', 'You can share the note from this day.');
  end if;

  if coalesce(array_length(group_ids, 1), 0) = 0 and coalesce(array_length(partner_ids, 1), 0) = 0 then
    delete from public.shared_notes where author_id = uid and day = local_day;
    return jsonb_build_object('ok', true, 'shared', false);
  end if;

  if char_length(cleaned) < 1 or char_length(cleaned) > 500 then
    return jsonb_build_object('error', 'Write a short note before sharing it.');
  end if;

  if coalesce(array_length(group_ids, 1), 0) > 20 or coalesce(array_length(partner_ids, 1), 0) > 5 then
    return jsonb_build_object('error', 'Choose fewer people.');
  end if;

  foreach gid in array coalesce(group_ids, '{}') loop
    if gid = any (seen) then
      continue;
    end if;
    if not exists (
      select 1 from public.group_members as member
      where member.group_id = gid and member.user_id = uid
    ) then
      return jsonb_build_object('error', 'You can only share with a group you are in.');
    end if;
    seen := array_append(seen, gid);
  end loop;

  seen := '{}';
  foreach pid in array coalesce(partner_ids, '{}') loop
    if pid = any (seen) or pid = uid then
      continue;
    end if;
    if not exists (
      select 1 from public.partnerships as partnership
      where partnership.status = 'active'
        and partnership.user_low = least(uid, pid)
        and partnership.user_high = greatest(uid, pid)
    ) then
      return jsonb_build_object('error', 'You can only share with a reading partner.');
    end if;
    seen := array_append(seen, pid);
  end loop;

  insert into public.shared_notes (author_id, day, body)
  values (uid, local_day, cleaned)
  on conflict (author_id, day) do update
    set body = excluded.body,
        updated_at = now()
  returning id into kept;

  delete from public.shared_note_groups where note_id = kept;
  delete from public.shared_note_partners where note_id = kept;

  insert into public.shared_note_groups (note_id, group_id)
  select distinct kept, group_target
  from unnest(coalesce(group_ids, '{}')) as group_target
  where exists (
    select 1 from public.group_members as member
    where member.group_id = group_target and member.user_id = uid
  );

  insert into public.shared_note_partners (note_id, recipient_id)
  select distinct kept, partner_target
  from unnest(coalesce(partner_ids, '{}')) as partner_target
  where partner_target <> uid
    and exists (
      select 1 from public.partnerships as partnership
      where partnership.status = 'active'
        and partnership.user_low = least(uid, partner_target)
        and partnership.user_high = greatest(uid, partner_target)
    );

  return jsonb_build_object('ok', true, 'id', kept, 'shared', true);
end;
$$;

create or replace function private.delete_shared_note(target uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  removed integer;
begin
  if uid is null then
    return jsonb_build_object('error', 'Sign in to remove a note.');
  end if;

  delete from public.shared_notes
  where id = target and author_id = uid;
  get diagnostics removed = row_count;
  if removed = 0 then
    return jsonb_build_object('error', 'That note isn’t yours to remove.');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

alter table public.group_plans enable row level security;
alter table public.group_plan_follows enable row level security;
alter table public.group_plan_reads enable row level security;
alter table public.shared_notes enable row level security;
alter table public.shared_note_groups enable row level security;
alter table public.shared_note_partners enable row level security;

revoke all on table public.group_plans from public, anon, authenticated;
revoke all on table public.group_plan_follows from public, anon, authenticated;
revoke all on table public.group_plan_reads from public, anon, authenticated;
revoke all on table public.shared_notes from public, anon, authenticated;
revoke all on table public.shared_note_groups from public, anon, authenticated;
revoke all on table public.shared_note_partners from public, anon, authenticated;

grant select on table public.group_plans to authenticated;
grant select on table public.group_plan_follows to authenticated;
grant select on table public.group_plan_reads to authenticated;
grant select on table public.shared_notes to authenticated;
grant select on table public.shared_note_groups to authenticated;
grant select on table public.shared_note_partners to authenticated;

create policy "Read the plan for your group"
  on public.group_plans
  for select
  to authenticated
  using (private.in_group(group_id));

create policy "Read who follows your group plan"
  on public.group_plan_follows
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.group_plans as plan
      where plan.id = plan_id
        and private.in_group(plan.group_id)
    )
  );

create policy "Read plan reads in your group"
  on public.group_plan_reads
  for select
  to authenticated
  using (
    day between (current_date - 1) and (current_date + 1)
    and exists (
      select 1
      from public.group_plans as plan
      where plan.id = plan_id
        and private.in_group(plan.group_id)
    )
  );

create policy "Read a note shared with you"
  on public.shared_notes
  for select
  to authenticated
  using (private.can_read_note(id));

create policy "Read group shares on notes you can see"
  on public.shared_note_groups
  for select
  to authenticated
  using (private.can_read_note(note_id));

create policy "Read partner shares on notes you can see"
  on public.shared_note_partners
  for select
  to authenticated
  using (private.can_read_note(note_id));

revoke all on function private.can_read_note(uuid) from public, anon, authenticated;
revoke all on function private.set_group_plan(uuid, text, integer, integer, text, integer, date) from public, anon, authenticated;
revoke all on function private.end_group_plan(uuid) from public, anon, authenticated;
revoke all on function private.follow_group_plan(uuid, text, date) from public, anon, authenticated;
revoke all on function private.leave_group_plan(uuid) from public, anon, authenticated;
revoke all on function private.record_plan_read(uuid, date) from public, anon, authenticated;
revoke all on function private.share_note(date, text, uuid[], uuid[]) from public, anon, authenticated;
revoke all on function private.delete_shared_note(uuid) from public, anon, authenticated;

grant execute on function private.can_read_note(uuid) to authenticated;
grant execute on function private.set_group_plan(uuid, text, integer, integer, text, integer, date) to authenticated;
grant execute on function private.end_group_plan(uuid) to authenticated;
grant execute on function private.follow_group_plan(uuid, text, date) to authenticated;
grant execute on function private.leave_group_plan(uuid) to authenticated;
grant execute on function private.record_plan_read(uuid, date) to authenticated;
grant execute on function private.share_note(date, text, uuid[], uuid[]) to authenticated;
grant execute on function private.delete_shared_note(uuid) to authenticated;

create or replace function public.set_group_plan(
  target_group uuid,
  book_id text,
  start_chapter integer,
  end_chapter integer,
  plan_pace text,
  reading_days integer,
  start_on date
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.set_group_plan(target_group, book_id, start_chapter, end_chapter, plan_pace, reading_days, start_on);
$$;

create or replace function public.end_group_plan(target_group uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.end_group_plan(target_group);
$$;

create or replace function public.follow_group_plan(target_group uuid, follow_mode text, local_day date)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.follow_group_plan(target_group, follow_mode, local_day);
$$;

create or replace function public.leave_group_plan(target_group uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.leave_group_plan(target_group);
$$;

create or replace function public.record_plan_read(target_group uuid, local_day date)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.record_plan_read(target_group, local_day);
$$;

create or replace function public.share_note(
  local_day date,
  note_body text,
  group_ids uuid[],
  partner_ids uuid[]
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.share_note(local_day, note_body, group_ids, partner_ids);
$$;

create or replace function public.delete_shared_note(target uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.delete_shared_note(target);
$$;

revoke all on function public.set_group_plan(uuid, text, integer, integer, text, integer, date) from public, anon;
revoke all on function public.end_group_plan(uuid) from public, anon;
revoke all on function public.follow_group_plan(uuid, text, date) from public, anon;
revoke all on function public.leave_group_plan(uuid) from public, anon;
revoke all on function public.record_plan_read(uuid, date) from public, anon;
revoke all on function public.share_note(date, text, uuid[], uuid[]) from public, anon;
revoke all on function public.delete_shared_note(uuid) from public, anon;

grant execute on function public.set_group_plan(uuid, text, integer, integer, text, integer, date) to authenticated;
grant execute on function public.end_group_plan(uuid) to authenticated;
grant execute on function public.follow_group_plan(uuid, text, date) to authenticated;
grant execute on function public.leave_group_plan(uuid) to authenticated;
grant execute on function public.record_plan_read(uuid, date) to authenticated;
grant execute on function public.share_note(date, text, uuid[], uuid[]) to authenticated;
grant execute on function public.delete_shared_note(uuid) to authenticated;
