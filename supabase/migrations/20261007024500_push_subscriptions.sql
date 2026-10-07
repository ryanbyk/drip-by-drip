-- Web Push subscriptions for ask-time reminders.
-- Guests never write this table. Server send uses the service role.
-- Signing out or turning reminders off deletes this device's row (RLS allows that delete).
-- Deleting the auth user removes the rows through on delete cascade.

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  time_zone text,
  last_sent_on date,
  updated_at timestamptz not null default now(),
  constraint push_subscriptions_endpoint_key unique (endpoint),
  constraint push_subscriptions_endpoint_length check (char_length(endpoint) between 1 and 2048),
  constraint push_subscriptions_p256dh_length check (char_length(p256dh) between 1 and 200),
  constraint push_subscriptions_auth_length check (char_length(auth) between 1 and 100),
  constraint push_subscriptions_user_agent_length check (user_agent is null or char_length(user_agent) between 1 and 512),
  constraint push_subscriptions_time_zone_length check (time_zone is null or char_length(time_zone) between 1 and 80)
);

comment on table public.push_subscriptions is 'Browser Web Push subscriptions for a signed-in reader. One row per endpoint.';
comment on column public.push_subscriptions.endpoint is 'Push service URL from PushManager. Unique across accounts.';
comment on column public.push_subscriptions.p256dh is 'Client public key for payload encryption.';
comment on column public.push_subscriptions.auth is 'Client auth secret for payload encryption.';
comment on column public.push_subscriptions.time_zone is 'IANA zone of the device that subscribed, used to match ask time.';
comment on column public.push_subscriptions.last_sent_on is 'Local date this endpoint already received the ask. Written by the service role.';

create index push_subscriptions_user_id_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

revoke all on table public.push_subscriptions from public, anon, authenticated;
grant select, insert, update, delete on table public.push_subscriptions to authenticated;
revoke insert (last_sent_on), update (last_sent_on) on table public.push_subscriptions from authenticated;

create policy "Read own push subscriptions"
  on public.push_subscriptions
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Insert own push subscription"
  on public.push_subscriptions
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Update own push subscription"
  on public.push_subscriptions
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Delete own push subscription"
  on public.push_subscriptions
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.set_push_subscriptions_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_push_subscriptions_updated_at() from public, anon;
grant execute on function public.set_push_subscriptions_updated_at() to authenticated;

create trigger push_subscriptions_set_updated_at
  before update on public.push_subscriptions
  for each row
  execute function public.set_push_subscriptions_updated_at();
