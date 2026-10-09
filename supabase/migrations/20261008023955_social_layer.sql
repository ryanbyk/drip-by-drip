-- v1.5b social layer.
-- Groups, more than one reading partner, and drops.
-- A partner or group member still learns only a display name and which days a drip was finished.
-- Answers, Not today, notes, Huh?, and the current book are not columns on these tables.
-- Writes go through private security-definer functions. Authenticated can only select.
--
-- Defaults (change the two cap functions to retune):
--   group size cap = private.group_member_cap() = 20
--   partner cap    = private.partner_cap()      = 5
--   drop rate      = one row per sender, recipient, and local day

create or replace function private.group_member_cap()
returns integer
language sql
immutable
security invoker
set search_path = ''
as $$
  select 20;
$$;

create or replace function private.partner_cap()
returns integer
language sql
immutable
security invoker
set search_path = ''
as $$
  select 5;
$$;

create or replace function private.active_partner_count(person uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.partnerships
  where status = 'active'
    and person in (user_low, user_high);
$$;

-- The v1.5a indexes allowed one active partnership per person. Drop them
-- before anyone can hold a second. The pair stays unique while active.
drop index if exists public.partnerships_active_low_idx;
drop index if exists public.partnerships_active_high_idx;

create unique index if not exists partnerships_active_pair_idx
  on public.partnerships (user_low, user_high)
  where status = 'active';

comment on table public.partnerships is
  'Reading partners, up to private.partner_cap() active partnerships per person. No answers, notes, or book names.';

create or replace function private.guard_partner_cap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.user_low is distinct from old.user_low
      or new.user_high is distinct from old.user_high
      or new.invited_by is distinct from old.invited_by
      or new.id is distinct from old.id
      or new.created_at is distinct from old.created_at
    then
      raise exception 'partnership members are fixed' using errcode = '42501';
    end if;
  end if;

  if new.status is distinct from 'active' then
    return new;
  end if;

  if (
    select count(*)
    from public.partnerships as partnership
    where partnership.status = 'active'
      and partnership.id is distinct from new.id
      and new.user_low in (partnership.user_low, partnership.user_high)
  ) >= private.partner_cap()
  or (
    select count(*)
    from public.partnerships as partnership
    where partnership.status = 'active'
      and partnership.id is distinct from new.id
      and new.user_high in (partnership.user_low, partnership.user_high)
  ) >= private.partner_cap()
  then
    raise exception 'partner cap' using errcode = '23505';
  end if;

  return new;
end;
$$;

drop trigger if exists partnerships_one_active on public.partnerships;

create trigger partnerships_partner_cap
  before insert or update of status, user_low, user_high, invited_by
  on public.partnerships
  for each row
  execute function private.guard_partner_cap();

alter table public.partner_invites
  add column if not exists invitee_id uuid references auth.users (id) on delete cascade;

comment on column public.partner_invites.invitee_id is
  'Set when the invite is for one person. Null is a shareable code.';

drop index if exists public.partner_invites_one_open_idx;

create unique index if not exists partner_invites_one_open_generic_idx
  on public.partner_invites (inviter_id)
  where status = 'open' and invitee_id is null;

create index if not exists partner_invites_invitee_idx
  on public.partner_invites (invitee_id)
  where invitee_id is not null;

create or replace function private.short_code(size integer)
returns text
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  bytes bytea := extensions.gen_random_bytes(size);
  result text := '';
  index integer;
begin
  if size < 1 or size > 32 then
    raise exception 'code length';
  end if;
  for index in 0..(size - 1) loop
    result := result || substr(alphabet, (get_byte(bytes, index) % 32) + 1, 1);
  end loop;
  return result;
end;
$$;

create or replace function private.create_partner_invite()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  new_code text;
  exp timestamptz := now() + interval '14 days';
  attempt integer;
begin
  if uid is null then
    return jsonb_build_object('error', 'Sign in to invite a partner.');
  end if;

  if private.active_partner_count(uid) >= private.partner_cap() then
    return jsonb_build_object('error', 'You can keep up to ' || private.partner_cap()::text || ' reading partners.');
  end if;

  update public.partner_invites
  set status = 'revoked'
  where inviter_id = uid
    and status = 'open'
    and invitee_id is null;

  for attempt in 1..8 loop
    new_code := private.partner_code();
    begin
      insert into public.partner_invites (inviter_id, code, expires_at)
      values (uid, new_code, exp);
      return jsonb_build_object('code', new_code, 'expires_at', exp);
    exception
      when unique_violation then
        null;
    end;
  end loop;

  return jsonb_build_object('error', 'Couldn’t create an invite just now. Try again in a moment.');
end;
$$;

create or replace function private.lookup_partner_invite(invite_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  inv public.partner_invites;
begin
  if uid is null then
    return jsonb_build_object('error', 'Sign in to join a partner.');
  end if;

  inv := private.take_open_invite(invite_code);
  if inv is null then
    return jsonb_build_object('error', 'That invite isn’t open.');
  end if;

  if inv.invitee_id is not null and inv.invitee_id is distinct from uid and inv.inviter_id is distinct from uid then
    return jsonb_build_object('error', 'That invite isn’t open.');
  end if;

  if inv.inviter_id = uid then
    return jsonb_build_object('own', true, 'inviter_name', 'You');
  end if;

  return jsonb_build_object(
    'own', false,
    'inviter_name', coalesce(private.partner_display_name(inv.inviter_id), 'A reader')
  );
end;
$$;

create or replace function private.accept_partner_invite(invite_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  inv public.partner_invites;
  low uuid;
  high uuid;
  partner_name text;
begin
  if uid is null then
    return jsonb_build_object('error', 'Sign in to join a partner.');
  end if;

  inv := private.take_open_invite(invite_code);
  if inv is null then
    return jsonb_build_object('error', 'That invite isn’t open.');
  end if;

  if inv.inviter_id = uid then
    return jsonb_build_object('error', 'That’s your invite. Share it with one person.');
  end if;

  if inv.invitee_id is not null and inv.invitee_id is distinct from uid then
    return jsonb_build_object('error', 'That invite isn’t open.');
  end if;

  if private.active_partner_count(uid) >= private.partner_cap()
    or private.active_partner_count(inv.inviter_id) >= private.partner_cap()
  then
    return jsonb_build_object('error', 'One of you is already reading with ' || private.partner_cap()::text || ' people.');
  end if;

  if uid < inv.inviter_id then
    low := uid;
    high := inv.inviter_id;
  else
    low := inv.inviter_id;
    high := uid;
  end if;

  if exists (
    select 1
    from public.partnerships as partnership
    where partnership.status = 'active'
      and partnership.user_low = low
      and partnership.user_high = high
  ) then
    return jsonb_build_object('error', 'You’re already reading with them.');
  end if;

  begin
    insert into public.partnerships (user_low, user_high, invited_by, status)
    values (low, high, inv.inviter_id, 'active');
  exception
    when unique_violation then
      return jsonb_build_object('error', 'One of you is already reading with ' || private.partner_cap()::text || ' people.');
  end;

  update public.partner_invites
  set status = 'accepted',
      accepted_by = uid
  where id = inv.id
    and status = 'open';

  if private.active_partner_count(uid) >= private.partner_cap() then
    update public.partner_invites
    set status = 'revoked'
    where inviter_id = uid
      and status = 'open';
  end if;

  if private.active_partner_count(inv.inviter_id) >= private.partner_cap() then
    update public.partner_invites
    set status = 'revoked'
    where inviter_id = inv.inviter_id
      and status = 'open';
  end if;

  partner_name := coalesce(private.partner_display_name(inv.inviter_id), 'A reader');
  return jsonb_build_object('ok', true, 'partner_name', partner_name);
end;
$$;

create or replace function private.decline_partner_invite(invite_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  inv public.partner_invites;
begin
  if uid is null then
    return jsonb_build_object('error', 'Sign in to answer an invite.');
  end if;

  inv := private.take_open_invite(invite_code);
  if inv is null then
    return jsonb_build_object('error', 'That invite isn’t open.');
  end if;

  if inv.inviter_id = uid then
    return jsonb_build_object('error', 'That’s your invite. You can reset it.');
  end if;

  if inv.invitee_id is not null and inv.invitee_id is distinct from uid then
    return jsonb_build_object('error', 'That invite isn’t open.');
  end if;

  update public.partner_invites
  set status = 'declined'
  where id = inv.id
    and status = 'open';

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function private.unlink_partner()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  n integer;
begin
  if uid is null then
    return jsonb_build_object('error', 'Sign in to unlink a partner.');
  end if;

  n := private.active_partner_count(uid);
  if n > 1 then
    return jsonb_build_object('error', 'Choose which partner to unlink.');
  end if;

  update public.partnerships
  set status = 'ended',
      ended_at = now()
  where status = 'active'
    and uid in (user_low, user_high);

  update public.partner_invites
  set status = 'revoked'
  where inviter_id = uid
    and status = 'open'
    and invitee_id is null;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function private.unlink_one_partner(partner_user uuid)
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
    return jsonb_build_object('error', 'Sign in to unlink a partner.');
  end if;

  if partner_user is null or partner_user = uid then
    return jsonb_build_object('error', 'Choose which partner to unlink.');
  end if;

  update public.partnerships
  set status = 'ended',
      ended_at = now()
  where status = 'active'
    and uid in (user_low, user_high)
    and partner_user in (user_low, user_high);

  get diagnostics removed = row_count;
  if removed = 0 then
    return jsonb_build_object('error', 'That partnership isn’t active.');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function private.invite_reading_partner(invitee uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  new_code text;
  exp timestamptz := now() + interval '14 days';
  attempt integer;
  low uuid;
  high uuid;
begin
  if uid is null then
    return jsonb_build_object('error', 'Sign in to invite a partner.');
  end if;

  if invitee is null or invitee = uid then
    return jsonb_build_object('error', 'Choose someone from a group you share.');
  end if;

  if not exists (
    select 1
    from public.group_members as mine
    join public.group_members as theirs
      on theirs.group_id = mine.group_id
    where mine.user_id = uid
      and theirs.user_id = invitee
  ) then
    return jsonb_build_object('error', 'Choose someone from a group you share.');
  end if;

  if private.active_partner_count(uid) >= private.partner_cap()
    or private.active_partner_count(invitee) >= private.partner_cap()
  then
    return jsonb_build_object('error', 'You can keep up to ' || private.partner_cap()::text || ' reading partners.');
  end if;

  if uid < invitee then
    low := uid;
    high := invitee;
  else
    low := invitee;
    high := uid;
  end if;

  if exists (
    select 1
    from public.partnerships as partnership
    where partnership.status = 'active'
      and partnership.user_low = low
      and partnership.user_high = high
  ) then
    return jsonb_build_object('error', 'You’re already reading with them.');
  end if;

  if exists (
    select 1
    from public.partner_invites as invite
    where invite.inviter_id = uid
      and invite.invitee_id = invitee
      and invite.status = 'open'
      and invite.expires_at > now()
  ) then
    return jsonb_build_object('error', 'That invite is already waiting.');
  end if;

  for attempt in 1..8 loop
    new_code := private.partner_code();
    begin
      insert into public.partner_invites (inviter_id, invitee_id, code, expires_at)
      values (uid, invitee, new_code, exp);
      return jsonb_build_object(
        'ok', true,
        'code', new_code,
        'expires_at', exp,
        'invitee_name', coalesce(private.partner_display_name(invitee), 'A reader')
      );
    exception
      when unique_violation then
        null;
    end;
  end loop;

  return jsonb_build_object('error', 'Couldn’t create an invite just now. Try again in a moment.');
end;
$$;

-- Groups. Everyone reads their own book until a later plan track exists.
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  owner_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint groups_name_len check (char_length(btrim(name)) between 1 and 80),
  constraint groups_description_len check (description is null or char_length(description) <= 200)
);

comment on table public.groups is
  'A reading group. Members see who finished a drip today. No answers, notes, or books. Cap is private.group_member_cap().';

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id),
  constraint group_members_role check (role in ('owner', 'member'))
);

comment on table public.group_members is
  'Membership is the only group access path. Role is owner or member.';

create index group_members_user_idx
  on public.group_members (user_id);

-- Security definer so group policies can ask "am I in this group?" without
-- re-entering row level security on group_members.
create or replace function private.in_group(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.group_members
    where group_id = target
      and user_id = auth.uid()
  );
$$;

create or replace function private.shares_group_with(other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select other is not null
    and other is distinct from auth.uid()
    and exists (
      select 1
      from public.group_members as mine
      join public.group_members as theirs
        on theirs.group_id = mine.group_id
      where mine.user_id = auth.uid()
        and theirs.user_id = other
    );
$$;

create or replace function private.shares_bond(left_user uuid, right_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    left_user is not null
    and right_user is not null
    and left_user <> right_user
    and (
      exists (
        select 1
        from public.partnerships as partnership
        where partnership.status = 'active'
          and partnership.user_low = least(left_user, right_user)
          and partnership.user_high = greatest(left_user, right_user)
      )
      or exists (
        select 1
        from public.group_members as mine
        join public.group_members as theirs
          on theirs.group_id = mine.group_id
        where mine.user_id = left_user
          and theirs.user_id = right_user
      )
    );
$$;

create table public.group_invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  created_by uuid not null references auth.users (id) on delete cascade,
  code text not null,
  status text not null default 'open',
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint group_invites_code_shape check (code ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$'),
  constraint group_invites_status check (status in ('open', 'revoked')),
  constraint group_invites_code_key unique (code)
);

comment on table public.group_invites is
  'Reusable until it expires or is reset. Joining does not consume the code.';

create unique index group_invites_one_open_idx
  on public.group_invites (group_id)
  where status = 'open';

create or replace function private.guard_group_size()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (
    select count(*)
    from public.group_members as member
    where member.group_id = new.group_id
  ) >= private.group_member_cap() then
    raise exception 'group is full' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger group_members_cap
  before insert on public.group_members
  for each row
  execute function private.guard_group_size();

-- Hand a group to the earliest other member when the owner leaves or deletes
-- their account. The last person leaving removes the group.
create or replace function private.release_group(target uuid, departing uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_owner uuid;
begin
  select member.user_id
  into next_owner
  from public.group_members as member
  where member.group_id = target
    and member.user_id is distinct from departing
  order by member.joined_at, member.user_id
  limit 1;

  if next_owner is null then
    delete from public.groups
    where id = target;
    return;
  end if;

  update public.groups
  set owner_id = next_owner
  where id = target
    and owner_id = departing;

  update public.group_members
  set role = 'owner'
  where group_id = target
    and user_id = next_owner;

  update public.group_members
  set role = 'member'
  where group_id = target
    and user_id is distinct from next_owner
    and role = 'owner';
end;
$$;

create or replace function private.before_user_removed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owned uuid;
begin
  for owned in
    select id
    from public.groups
    where owner_id = old.id
  loop
    perform private.release_group(owned, old.id);
  end loop;
  return old;
end;
$$;

drop trigger if exists users_release_groups on auth.users;

create trigger users_release_groups
  before delete on auth.users
  for each row
  execute function private.before_user_removed();

create or replace function private.open_group_invite(raw text)
returns public.group_invites
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized text := private.normalize_partner_code(raw);
  inv public.group_invites;
begin
  if char_length(normalized) <> 6 then
    return null;
  end if;

  select *
  into inv
  from public.group_invites
  where code = normalized
  for update;

  if not found then
    return null;
  end if;

  if inv.status <> 'open' or inv.expires_at <= now() then
    if inv.status = 'open' and inv.expires_at <= now() then
      update public.group_invites
      set status = 'revoked'
      where id = inv.id;
    end if;
    return null;
  end if;

  return inv;
end;
$$;

create or replace function private.issue_group_invite(target uuid, actor uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_code text;
  exp timestamptz := now() + interval '14 days';
  attempt integer;
begin
  if not exists (
    select 1
    from public.group_members as member
    where member.group_id = target
      and member.user_id = actor
  ) then
    return jsonb_build_object('error', 'Join the group before inviting.');
  end if;

  update public.group_invites
  set status = 'revoked'
  where group_id = target
    and status = 'open';

  for attempt in 1..8 loop
    new_code := private.short_code(6);
    begin
      insert into public.group_invites (group_id, created_by, code, expires_at)
      values (target, actor, new_code, exp);
      return jsonb_build_object('code', new_code, 'expires_at', exp);
    exception
      when unique_violation then
        null;
    end;
  end loop;

  return jsonb_build_object('error', 'Couldn’t make an invite just now. Try again in a moment.');
end;
$$;

create or replace function private.create_group(group_name text, group_description text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  cleaned text := btrim(coalesce(group_name, ''));
  about text := nullif(btrim(coalesce(group_description, '')), '');
  new_id uuid;
  issued jsonb;
begin
  if uid is null then
    return jsonb_build_object('error', 'Sign in to start a group.');
  end if;

  if char_length(cleaned) < 1 or char_length(cleaned) > 80 then
    return jsonb_build_object('error', 'Give the group a name.');
  end if;

  if about is not null and char_length(about) > 200 then
    return jsonb_build_object('error', 'Keep the description shorter.');
  end if;

  insert into public.groups (name, description, owner_id)
  values (cleaned, about, uid)
  returning id into new_id;

  insert into public.group_members (group_id, user_id, role)
  values (new_id, uid, 'owner');

  issued := private.issue_group_invite(new_id, uid);
  if issued ? 'error' then
    delete from public.groups where id = new_id;
    return issued;
  end if;

  return issued || jsonb_build_object('id', new_id, 'name', cleaned);
end;
$$;

create or replace function private.rename_group(target_group uuid, group_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  cleaned text := btrim(coalesce(group_name, ''));
begin
  if uid is null then
    return jsonb_build_object('error', 'Sign in to rename a group.');
  end if;

  if char_length(cleaned) < 1 or char_length(cleaned) > 80 then
    return jsonb_build_object('error', 'Give the group a name.');
  end if;

  update public.groups
  set name = cleaned
  where id = target_group
    and owner_id = uid;

  if not found then
    return jsonb_build_object('error', 'Only the owner can rename this group.');
  end if;

  return jsonb_build_object('ok', true, 'name', cleaned);
end;
$$;

create or replace function private.leave_group(target_group uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  owner uuid;
begin
  if uid is null then
    return jsonb_build_object('error', 'Sign in to leave a group.');
  end if;

  select groups.owner_id
  into owner
  from public.groups as groups
  where groups.id = target_group;

  if owner is null then
    return jsonb_build_object('error', 'That group isn’t open.');
  end if;

  if not exists (
    select 1
    from public.group_members as member
    where member.group_id = target_group
      and member.user_id = uid
  ) then
    return jsonb_build_object('error', 'You aren’t in that group.');
  end if;

  if owner = uid then
    perform private.release_group(target_group, uid);
  end if;

  delete from public.group_members
  where group_id = target_group
    and user_id = uid;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function private.remove_group_member(target_group uuid, member_user uuid)
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
    return jsonb_build_object('error', 'Sign in to remove a member.');
  end if;

  if member_user is null or member_user = uid then
    return jsonb_build_object('error', 'Leave the group if you want to step out.');
  end if;

  if not exists (
    select 1
    from public.groups as groups
    where groups.id = target_group
      and groups.owner_id = uid
  ) then
    return jsonb_build_object('error', 'Only the owner can remove a member.');
  end if;

  delete from public.group_members
  where group_id = target_group
    and user_id = member_user
    and role <> 'owner';

  get diagnostics removed = row_count;
  if removed = 0 then
    return jsonb_build_object('error', 'That person isn’t a member you can remove.');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function private.create_group_invite(target_group uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    return jsonb_build_object('error', 'Sign in to invite someone.');
  end if;

  return private.issue_group_invite(target_group, uid);
end;
$$;

create or replace function private.lookup_group_invite(invite_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  inv public.group_invites;
  grp public.groups;
  members integer;
begin
  if uid is null then
    return jsonb_build_object('error', 'Sign in to join a group.');
  end if;

  inv := private.open_group_invite(invite_code);
  if inv is null then
    return jsonb_build_object('error', 'That code isn’t open.');
  end if;

  select *
  into grp
  from public.groups
  where id = inv.group_id;

  if not found then
    return jsonb_build_object('error', 'That code isn’t open.');
  end if;

  select count(*)::integer
  into members
  from public.group_members as member
  where member.group_id = grp.id;

  return jsonb_build_object(
    'name', grp.name,
    'leader_name', coalesce(private.partner_display_name(grp.owner_id), 'A reader'),
    'member_count', members,
    'already_member', exists (
      select 1
      from public.group_members as member
      where member.group_id = grp.id
        and member.user_id = uid
    ),
    'full', members >= private.group_member_cap()
  );
end;
$$;

create or replace function private.join_group(invite_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  inv public.group_invites;
  members integer;
begin
  if uid is null then
    return jsonb_build_object('error', 'Sign in to join a group.');
  end if;

  inv := private.open_group_invite(invite_code);
  if inv is null then
    return jsonb_build_object('error', 'That code isn’t open.');
  end if;

  if exists (
    select 1
    from public.group_members as member
    where member.group_id = inv.group_id
      and member.user_id = uid
  ) then
    return jsonb_build_object('ok', true, 'already', true, 'id', inv.group_id);
  end if;

  select count(*)::integer
  into members
  from public.group_members as member
  where member.group_id = inv.group_id;

  if members >= private.group_member_cap() then
    return jsonb_build_object('error', 'This group is full.');
  end if;

  begin
    insert into public.group_members (group_id, user_id, role)
    values (inv.group_id, uid, 'member');
  exception
    when unique_violation then
      return jsonb_build_object('ok', true, 'already', true, 'id', inv.group_id);
    when check_violation then
      return jsonb_build_object('error', 'This group is full.');
  end;

  return jsonb_build_object('ok', true, 'id', inv.group_id);
end;
$$;

-- A drop is the encouragement between friends: a partner, or someone in a shared group.
-- The canned line is optional. One drop per sender per recipient per local day.
create table public.drops (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users (id) on delete cascade,
  recipient_id uuid not null references auth.users (id) on delete cascade,
  body text,
  day date not null,
  created_at timestamptz not null default now(),
  seen_at timestamptz,
  constraint drops_distinct check (sender_id <> recipient_id),
  constraint drops_body check (
    body is null
    or body in (
      'Thinking of you. How’s the Word today?',
      'A quiet hello. The Word will still be here whenever you’re ready.',
      'Praying you get a drip in today, whenever it fits.'
    )
  ),
  constraint drops_one_per_recipient_per_day unique (sender_id, recipient_id, day)
);

comment on table public.drops is
  'One quiet drop per sender per recipient per local day. Optional canned line. No free text.';

create index drops_recipient_idx
  on public.drops (recipient_id, created_at desc);

insert into public.drops (id, sender_id, recipient_id, body, day, created_at, seen_at)
select id, sender_id, recipient_id, body, day, created_at, seen_at
from public.partner_nudges
on conflict (sender_id, recipient_id, day) do nothing;

create or replace function private.mirror_nudge_to_drop()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.drops (id, sender_id, recipient_id, body, day, created_at, seen_at)
  values (new.id, new.sender_id, new.recipient_id, new.body, new.day, new.created_at, new.seen_at)
  on conflict (sender_id, recipient_id, day) do nothing;
  return new;
end;
$$;

drop trigger if exists partner_nudges_mirror_drop on public.partner_nudges;

create trigger partner_nudges_mirror_drop
  after insert on public.partner_nudges
  for each row
  execute function private.mirror_nudge_to_drop();

create or replace function private.send_partner_nudge(message text, local_day date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  n integer;
  partnership_id uuid;
  recipient uuid;
begin
  if uid is null then
    return jsonb_build_object('error', 'Sign in to send a nudge.');
  end if;

  if message is null or message not in (
    'Thinking of you. How’s the Word today?',
    'A quiet hello. The Word will still be here whenever you’re ready.',
    'Praying you get a drip in today, whenever it fits.'
  ) then
    return jsonb_build_object('error', 'Choose one of the gentle notes.');
  end if;

  if local_day is null or local_day < (current_date - 1) or local_day > (current_date + 1) then
    return jsonb_build_object('error', 'That day isn’t open for a nudge.');
  end if;

  n := private.active_partner_count(uid);
  if n = 0 then
    return jsonb_build_object('error', 'A reading partner is needed before that.');
  end if;
  if n > 1 then
    return jsonb_build_object('error', 'Choose which partner.');
  end if;

  select
    partnership.id,
    case when partnership.user_low = uid then partnership.user_high else partnership.user_low end
  into partnership_id, recipient
  from public.partnerships as partnership
  where partnership.status = 'active'
    and uid in (partnership.user_low, partnership.user_high);

  if partnership_id is null or recipient is null then
    return jsonb_build_object('error', 'A reading partner is needed before that.');
  end if;

  begin
    insert into public.partner_nudges (partnership_id, sender_id, recipient_id, body, day)
    values (partnership_id, uid, recipient, message, local_day);
  exception
    when unique_violation then
      return jsonb_build_object('error', 'You’ve already sent a gentle nudge today.');
  end;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function private.see_partner_nudge(nudge_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    return jsonb_build_object('error', 'Sign in to keep a note.');
  end if;

  update public.partner_nudges
  set seen_at = now()
  where id = nudge_id
    and recipient_id = uid
    and seen_at is null;

  update public.drops
  set seen_at = now()
  where id = nudge_id
    and recipient_id = uid
    and seen_at is null;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function private.send_drop(recipient uuid, message text, local_day date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  note text := nullif(btrim(coalesce(message, '')), '');
begin
  if uid is null then
    return jsonb_build_object('error', 'Sign in to send a drop.');
  end if;

  if recipient is null or recipient = uid then
    return jsonb_build_object('error', 'Choose a partner or someone in a group you share.');
  end if;

  if note is not null and note not in (
    'Thinking of you. How’s the Word today?',
    'A quiet hello. The Word will still be here whenever you’re ready.',
    'Praying you get a drip in today, whenever it fits.'
  ) then
    return jsonb_build_object('error', 'Choose one of the gentle notes, or send the drop on its own.');
  end if;

  if local_day is null or local_day < (current_date - 1) or local_day > (current_date + 1) then
    return jsonb_build_object('error', 'That day isn’t open for a drop.');
  end if;

  if not private.shares_bond(uid, recipient) then
    return jsonb_build_object('error', 'A drop stays between people who read together.');
  end if;

  begin
    insert into public.drops (sender_id, recipient_id, body, day)
    values (uid, recipient, note, local_day);
  exception
    when unique_violation then
      return jsonb_build_object('error', 'You’ve already sent them a drop today.');
  end;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function private.see_drop(drop_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    return jsonb_build_object('error', 'Sign in to keep a drop.');
  end if;

  update public.drops
  set seen_at = now()
  where id = drop_id
    and recipient_id = uid
    and seen_at is null;

  update public.partner_nudges
  set seen_at = now()
  where id = drop_id
    and recipient_id = uid
    and seen_at is null;

  return jsonb_build_object('ok', true);
end;
$$;

alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_invites enable row level security;
alter table public.drops enable row level security;

revoke all on table public.groups from public, anon, authenticated;
revoke all on table public.group_members from public, anon, authenticated;
revoke all on table public.group_invites from public, anon, authenticated;
revoke all on table public.drops from public, anon, authenticated;

grant select on table public.groups to authenticated;
grant select on table public.group_members to authenticated;
grant select on table public.group_invites to authenticated;
grant select on table public.drops to authenticated;

create policy "Read groups you belong to"
  on public.groups
  for select
  to authenticated
  using (private.in_group(id));

create policy "Read members of your groups"
  on public.group_members
  for select
  to authenticated
  using (private.in_group(group_id));

create policy "Read invites for your groups"
  on public.group_invites
  for select
  to authenticated
  using (private.in_group(group_id));

create policy "Read invites addressed to you"
  on public.partner_invites
  for select
  to authenticated
  using (
    invitee_id = (select auth.uid())
    and status = 'open'
    and expires_at > now()
  );

create policy "Read drops between friends"
  on public.drops
  for select
  to authenticated
  using (
    (select auth.uid()) in (sender_id, recipient_id)
    and (
      exists (
        select 1
        from public.partnerships as partnership
        where partnership.status = 'active'
          and (select auth.uid()) in (partnership.user_low, partnership.user_high)
          and sender_id in (partnership.user_low, partnership.user_high)
          and recipient_id in (partnership.user_low, partnership.user_high)
      )
      or private.shares_group_with(case
        when sender_id = (select auth.uid()) then recipient_id
        else sender_id
      end)
    )
  );

create policy "Group members read each other’s recent read days"
  on public.partner_read_days
  for select
  to authenticated
  using (
    day between (current_date - 1) and (current_date + 1)
    and user_id <> (select auth.uid())
    and exists (
      select 1
      from public.group_members as mine
      join public.group_members as theirs
        on theirs.group_id = mine.group_id
      where mine.user_id = (select auth.uid())
        and theirs.user_id = partner_read_days.user_id
    )
  );

create policy "Group members read each other’s display name"
  on public.profiles
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.group_members as mine
      join public.group_members as theirs
        on theirs.group_id = mine.group_id
      where mine.user_id = (select auth.uid())
        and theirs.user_id = profiles.id
        and theirs.user_id <> (select auth.uid())
    )
  );

create policy "Read a partner inviter’s display name"
  on public.profiles
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.partner_invites as invite
      where invite.inviter_id = profiles.id
        and invite.invitee_id = (select auth.uid())
        and invite.status = 'open'
        and invite.expires_at > now()
    )
  );

revoke all on function private.group_member_cap() from public, anon, authenticated;
revoke all on function private.partner_cap() from public, anon, authenticated;
revoke all on function private.active_partner_count(uuid) from public, anon, authenticated;
revoke all on function private.guard_partner_cap() from public, anon, authenticated;
revoke all on function private.short_code(integer) from public, anon, authenticated;
revoke all on function private.in_group(uuid) from public, anon, authenticated;
revoke all on function private.shares_group_with(uuid) from public, anon, authenticated;
revoke all on function private.shares_bond(uuid, uuid) from public, anon, authenticated;
revoke all on function private.unlink_one_partner(uuid) from public, anon, authenticated;
revoke all on function private.invite_reading_partner(uuid) from public, anon, authenticated;
revoke all on function private.guard_group_size() from public, anon, authenticated;
revoke all on function private.release_group(uuid, uuid) from public, anon, authenticated;
revoke all on function private.before_user_removed() from public, anon, authenticated;
revoke all on function private.open_group_invite(text) from public, anon, authenticated;
revoke all on function private.issue_group_invite(uuid, uuid) from public, anon, authenticated;
revoke all on function private.create_group(text, text) from public, anon, authenticated;
revoke all on function private.rename_group(uuid, text) from public, anon, authenticated;
revoke all on function private.leave_group(uuid) from public, anon, authenticated;
revoke all on function private.remove_group_member(uuid, uuid) from public, anon, authenticated;
revoke all on function private.create_group_invite(uuid) from public, anon, authenticated;
revoke all on function private.lookup_group_invite(text) from public, anon, authenticated;
revoke all on function private.join_group(text) from public, anon, authenticated;
revoke all on function private.mirror_nudge_to_drop() from public, anon, authenticated;
revoke all on function private.send_drop(uuid, text, date) from public, anon, authenticated;
revoke all on function private.see_drop(uuid) from public, anon, authenticated;

grant execute on function private.in_group(uuid) to authenticated;
grant execute on function private.shares_group_with(uuid) to authenticated;
grant execute on function private.create_group(text, text) to authenticated;
grant execute on function private.rename_group(uuid, text) to authenticated;
grant execute on function private.leave_group(uuid) to authenticated;
grant execute on function private.remove_group_member(uuid, uuid) to authenticated;
grant execute on function private.create_group_invite(uuid) to authenticated;
grant execute on function private.lookup_group_invite(text) to authenticated;
grant execute on function private.join_group(text) to authenticated;
grant execute on function private.invite_reading_partner(uuid) to authenticated;
grant execute on function private.unlink_one_partner(uuid) to authenticated;
grant execute on function private.send_drop(uuid, text, date) to authenticated;
grant execute on function private.see_drop(uuid) to authenticated;

create or replace function public.create_group(group_name text, group_description text)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.create_group(group_name, group_description);
$$;

create or replace function public.rename_group(target_group uuid, group_name text)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.rename_group(target_group, group_name);
$$;

create or replace function public.leave_group(target_group uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.leave_group(target_group);
$$;

create or replace function public.remove_group_member(target_group uuid, member_user uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.remove_group_member(target_group, member_user);
$$;

create or replace function public.create_group_invite(target_group uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.create_group_invite(target_group);
$$;

create or replace function public.lookup_group_invite(invite_code text)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.lookup_group_invite(invite_code);
$$;

create or replace function public.join_group(invite_code text)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.join_group(invite_code);
$$;

create or replace function public.invite_reading_partner(invitee uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.invite_reading_partner(invitee);
$$;

create or replace function public.unlink_one_partner(partner_user uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.unlink_one_partner(partner_user);
$$;

create or replace function public.send_drop(recipient uuid, message text, local_day date)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.send_drop(recipient, message, local_day);
$$;

create or replace function public.see_drop(drop_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.see_drop(drop_id);
$$;

revoke all on function public.create_group(text, text) from public, anon;
revoke all on function public.rename_group(uuid, text) from public, anon;
revoke all on function public.leave_group(uuid) from public, anon;
revoke all on function public.remove_group_member(uuid, uuid) from public, anon;
revoke all on function public.create_group_invite(uuid) from public, anon;
revoke all on function public.lookup_group_invite(text) from public, anon;
revoke all on function public.join_group(text) from public, anon;
revoke all on function public.invite_reading_partner(uuid) from public, anon;
revoke all on function public.unlink_one_partner(uuid) from public, anon;
revoke all on function public.send_drop(uuid, text, date) from public, anon;
revoke all on function public.see_drop(uuid) from public, anon;

grant execute on function public.create_group(text, text) to authenticated;
grant execute on function public.rename_group(uuid, text) to authenticated;
grant execute on function public.leave_group(uuid) to authenticated;
grant execute on function public.remove_group_member(uuid, uuid) to authenticated;
grant execute on function public.create_group_invite(uuid) to authenticated;
grant execute on function public.lookup_group_invite(text) to authenticated;
grant execute on function public.join_group(text) to authenticated;
grant execute on function public.invite_reading_partner(uuid) to authenticated;
grant execute on function public.unlink_one_partner(uuid) to authenticated;
grant execute on function public.send_drop(uuid, text, date) to authenticated;
grant execute on function public.see_drop(uuid) to authenticated;
