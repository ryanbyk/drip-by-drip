-- One reading partner, an invite code, and a gentle nudge.
-- Partners never receive a QBE answer, a reflection, a Huh? tag, or a book name.
-- The only presence bit is partner_read_days: a date on which this person finished a drip.
-- Missing a row means nothing — not “Not today”, not unanswered, not Yes without reading.
-- Writes go through private security-definer functions. Authenticated can only select.

create table public.partnerships (
  id uuid primary key default gen_random_uuid(),
  user_low uuid not null references auth.users (id) on delete cascade,
  user_high uuid not null references auth.users (id) on delete cascade,
  invited_by uuid not null references auth.users (id) on delete cascade,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  ended_at timestamptz,
  constraint partnerships_ordered check (user_low < user_high),
  constraint partnerships_status check (status in ('active', 'ended'))
);

comment on table public.partnerships is 'One active reading partner. No answers, notes, or book names.';

create unique index partnerships_active_low_idx
  on public.partnerships (user_low)
  where status = 'active';

create unique index partnerships_active_high_idx
  on public.partnerships (user_high)
  where status = 'active';

create table public.partner_invites (
  id uuid primary key default gen_random_uuid(),
  inviter_id uuid not null references auth.users (id) on delete cascade,
  code text not null,
  status text not null default 'open',
  expires_at timestamptz not null,
  accepted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint partner_invites_code_shape check (code ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$'),
  constraint partner_invites_status check (status in ('open', 'accepted', 'declined', 'revoked')),
  constraint partner_invites_code_key unique (code)
);

comment on table public.partner_invites is 'Single-use partner invite. Lookup does not list other people’s codes.';

create unique index partner_invites_one_open_idx
  on public.partner_invites (inviter_id)
  where status = 'open';

create table public.partner_nudges (
  id uuid primary key default gen_random_uuid(),
  partnership_id uuid not null references public.partnerships (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  recipient_id uuid not null references auth.users (id) on delete cascade,
  body text not null,
  day date not null,
  created_at timestamptz not null default now(),
  seen_at timestamptz,
  constraint partner_nudges_distinct check (sender_id <> recipient_id),
  constraint partner_nudges_body check (
    body in (
      'Thinking of you. How’s the Word today?',
      'A quiet hello. The Word will still be here whenever you’re ready.',
      'Praying you get a drip in today, whenever it fits.'
    )
  ),
  constraint partner_nudges_one_per_day unique (sender_id, day)
);

comment on table public.partner_nudges is 'One canned grace note per sender per day. No free text.';

create index partner_nudges_partnership_idx
  on public.partner_nudges (partnership_id, created_at desc);

create index partner_nudges_recipient_idx
  on public.partner_nudges (recipient_id);

create index partnerships_invited_by_idx
  on public.partnerships (invited_by);

create index partner_invites_accepted_by_idx
  on public.partner_invites (accepted_by);

create table public.partner_read_days (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  primary key (user_id, day)
);

comment on table public.partner_read_days is 'Days a drip was finished. No answer column. Absence is not a No.';

alter table public.partnerships enable row level security;
alter table public.partner_invites enable row level security;
alter table public.partner_nudges enable row level security;
alter table public.partner_read_days enable row level security;

revoke all on table public.partnerships from public, anon, authenticated;
revoke all on table public.partner_invites from public, anon, authenticated;
revoke all on table public.partner_nudges from public, anon, authenticated;
revoke all on table public.partner_read_days from public, anon, authenticated;

grant select on table public.partnerships to authenticated;
grant select on table public.partner_invites to authenticated;
grant select on table public.partner_nudges to authenticated;
grant select on table public.partner_read_days to authenticated;

create policy "Read own active partnership"
  on public.partnerships
  for select
  to authenticated
  using (
    status = 'active'
    and (select auth.uid()) in (user_low, user_high)
  );

create policy "Read own partner invites"
  on public.partner_invites
  for select
  to authenticated
  using (inviter_id = (select auth.uid()));

create policy "Read nudges in an active partnership"
  on public.partner_nudges
  for select
  to authenticated
  using (
    (select auth.uid()) in (sender_id, recipient_id)
    and exists (
      select 1
      from public.partnerships as partnership
      where partnership.id = partnership_id
        and partnership.status = 'active'
        and (select auth.uid()) in (partnership.user_low, partnership.user_high)
    )
  );

create policy "Read own read days and a partner’s recent days"
  on public.partner_read_days
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or (
      day between (current_date - 1) and (current_date + 1)
      and exists (
        select 1
        from public.partnerships as partnership
        where partnership.status = 'active'
          and (select auth.uid()) in (partnership.user_low, partnership.user_high)
          and user_id in (partnership.user_low, partnership.user_high)
          and user_id <> (select auth.uid())
      )
    )
  );

create policy "Partners read each other’s display name"
  on public.profiles
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.partnerships as partnership
      where partnership.status = 'active'
        and (select auth.uid()) in (partnership.user_low, partnership.user_high)
        and profiles.id in (partnership.user_low, partnership.user_high)
        and profiles.id <> (select auth.uid())
    )
  );

create or replace function private.normalize_partner_code(raw text)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select regexp_replace(
    upper(coalesce(raw, '')),
    '[^ABCDEFGHJKLMNPQRSTUVWXYZ23456789]',
    '',
    'g'
  );
$$;

create or replace function private.partner_code()
returns text
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  bytes bytea := extensions.gen_random_bytes(8);
  result text := '';
  index integer;
begin
  for index in 0..7 loop
    result := result || substr(alphabet, (get_byte(bytes, index) % 32) + 1, 1);
  end loop;
  return result;
end;
$$;

create or replace function private.guard_one_active_partner()
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

  if exists (
    select 1
    from public.partnerships as partnership
    where partnership.status = 'active'
      and partnership.id is distinct from new.id
      and (
        partnership.user_low in (new.user_low, new.user_high)
        or partnership.user_high in (new.user_low, new.user_high)
      )
  ) then
    raise exception 'one active partner' using errcode = '23505';
  end if;

  return new;
end;
$$;

create trigger partnerships_one_active
  before insert or update of status, user_low, user_high, invited_by
  on public.partnerships
  for each row
  execute function private.guard_one_active_partner();

create or replace function private.take_open_invite(raw text)
returns public.partner_invites
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized text := private.normalize_partner_code(raw);
  inv public.partner_invites;
begin
  if char_length(normalized) <> 8 then
    return null;
  end if;

  select *
  into inv
  from public.partner_invites
  where code = normalized
  for update;

  if not found then
    return null;
  end if;

  if inv.status <> 'open' or inv.expires_at <= now() then
    if inv.status = 'open' and inv.expires_at <= now() then
      update public.partner_invites
      set status = 'revoked'
      where id = inv.id;
    end if;
    return null;
  end if;

  return inv;
end;
$$;

create or replace function private.partner_display_name(person uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    nullif(btrim(display_name), ''),
    'A reader'
  )
  from public.profiles
  where id = person;
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

  if exists (
    select 1
    from public.partnerships as partnership
    where partnership.status = 'active'
      and uid in (partnership.user_low, partnership.user_high)
  ) then
    return jsonb_build_object('error', 'You already have a reading partner.');
  end if;

  update public.partner_invites
  set status = 'revoked'
  where inviter_id = uid
    and status = 'open';

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

  if exists (
    select 1
    from public.partnerships as partnership
    where partnership.status = 'active'
      and (
        uid in (partnership.user_low, partnership.user_high)
        or inv.inviter_id in (partnership.user_low, partnership.user_high)
      )
  ) then
    return jsonb_build_object('error', 'One of you already has a reading partner.');
  end if;

  if uid < inv.inviter_id then
    low := uid;
    high := inv.inviter_id;
  else
    low := inv.inviter_id;
    high := uid;
  end if;

  begin
    insert into public.partnerships (user_low, user_high, invited_by, status)
    values (low, high, inv.inviter_id, 'active');
  exception
    when unique_violation then
      return jsonb_build_object('error', 'One of you already has a reading partner.');
  end;

  update public.partner_invites
  set status = 'accepted',
      accepted_by = uid
  where id = inv.id
    and status = 'open';

  update public.partner_invites
  set status = 'revoked'
  where status = 'open'
    and inviter_id in (uid, inv.inviter_id);

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

  update public.partner_invites
  set status = 'declined'
  where id = inv.id
    and status = 'open';

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function private.revoke_partner_invite()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    return jsonb_build_object('error', 'Sign in to reset an invite.');
  end if;

  update public.partner_invites
  set status = 'revoked'
  where inviter_id = uid
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
begin
  if uid is null then
    return jsonb_build_object('error', 'Sign in to unlink a partner.');
  end if;

  update public.partnerships
  set status = 'ended',
      ended_at = now()
  where status = 'active'
    and uid in (user_low, user_high);

  update public.partner_invites
  set status = 'revoked'
  where inviter_id = uid
    and status = 'open';

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function private.send_partner_nudge(message text, local_day date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
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

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function private.set_partner_read_day(local_day date, did_read boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    return jsonb_build_object('error', 'Sign in to share that you read.');
  end if;

  if local_day is null or local_day < (current_date - 1) or local_day > (current_date + 1) then
    return jsonb_build_object('error', 'That day isn’t open.');
  end if;

  if did_read then
    insert into public.partner_read_days (user_id, day)
    values (uid, local_day)
    on conflict (user_id, day) do nothing;
  else
    delete from public.partner_read_days
    where user_id = uid
      and day = local_day;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function private.normalize_partner_code(text) from public, anon, authenticated;
revoke all on function private.partner_code() from public, anon, authenticated;
revoke all on function private.guard_one_active_partner() from public, anon, authenticated;
revoke all on function private.take_open_invite(text) from public, anon, authenticated;
revoke all on function private.partner_display_name(uuid) from public, anon, authenticated;
revoke all on function private.create_partner_invite() from public, anon, authenticated;
revoke all on function private.lookup_partner_invite(text) from public, anon, authenticated;
revoke all on function private.accept_partner_invite(text) from public, anon, authenticated;
revoke all on function private.decline_partner_invite(text) from public, anon, authenticated;
revoke all on function private.revoke_partner_invite() from public, anon, authenticated;
revoke all on function private.unlink_partner() from public, anon, authenticated;
revoke all on function private.send_partner_nudge(text, date) from public, anon, authenticated;
revoke all on function private.see_partner_nudge(uuid) from public, anon, authenticated;
revoke all on function private.set_partner_read_day(date, boolean) from public, anon, authenticated;

grant execute on function private.create_partner_invite() to authenticated;
grant execute on function private.lookup_partner_invite(text) to authenticated;
grant execute on function private.accept_partner_invite(text) to authenticated;
grant execute on function private.decline_partner_invite(text) to authenticated;
grant execute on function private.revoke_partner_invite() to authenticated;
grant execute on function private.unlink_partner() to authenticated;
grant execute on function private.send_partner_nudge(text, date) to authenticated;
grant execute on function private.see_partner_nudge(uuid) to authenticated;
grant execute on function private.set_partner_read_day(date, boolean) to authenticated;

grant usage on schema private to authenticated;

create or replace function public.create_partner_invite()
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.create_partner_invite();
$$;

create or replace function public.lookup_partner_invite(invite_code text)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.lookup_partner_invite(invite_code);
$$;

create or replace function public.accept_partner_invite(invite_code text)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.accept_partner_invite(invite_code);
$$;

create or replace function public.decline_partner_invite(invite_code text)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.decline_partner_invite(invite_code);
$$;

create or replace function public.revoke_partner_invite()
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.revoke_partner_invite();
$$;

create or replace function public.unlink_partner()
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.unlink_partner();
$$;

create or replace function public.send_partner_nudge(message text, local_day date)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.send_partner_nudge(message, local_day);
$$;

create or replace function public.see_partner_nudge(nudge_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.see_partner_nudge(nudge_id);
$$;

create or replace function public.set_partner_read_day(local_day date, did_read boolean)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.set_partner_read_day(local_day, did_read);
$$;

revoke all on function public.create_partner_invite() from public, anon;
revoke all on function public.lookup_partner_invite(text) from public, anon;
revoke all on function public.accept_partner_invite(text) from public, anon;
revoke all on function public.decline_partner_invite(text) from public, anon;
revoke all on function public.revoke_partner_invite() from public, anon;
revoke all on function public.unlink_partner() from public, anon;
revoke all on function public.send_partner_nudge(text, date) from public, anon;
revoke all on function public.see_partner_nudge(uuid) from public, anon;
revoke all on function public.set_partner_read_day(date, boolean) from public, anon;

grant execute on function public.create_partner_invite() to authenticated;
grant execute on function public.lookup_partner_invite(text) to authenticated;
grant execute on function public.accept_partner_invite(text) to authenticated;
grant execute on function public.decline_partner_invite(text) to authenticated;
grant execute on function public.revoke_partner_invite() to authenticated;
grant execute on function public.unlink_partner() to authenticated;
grant execute on function public.send_partner_nudge(text, date) to authenticated;
grant execute on function public.see_partner_nudge(uuid) to authenticated;
grant execute on function public.set_partner_read_day(date, boolean) to authenticated;
