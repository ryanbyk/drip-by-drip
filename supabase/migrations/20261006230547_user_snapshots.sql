-- One reading snapshot per account. Guests never write this table.
-- updated_at is the snapshot clock (payload.updatedAt), not wall-clock now().
-- Delete account removes the row through auth.users ... on delete cascade.

create table public.user_snapshots (
  user_id uuid primary key references auth.users (id) on delete cascade,
  payload jsonb not null,
  updated_at timestamptz not null,
  constraint user_snapshots_payload_object check (jsonb_typeof(payload) = 'object')
);

comment on table public.user_snapshots is 'Reading snapshot for the signed-in account. One row per user.';
comment on column public.user_snapshots.payload is 'Versioned reading snapshot: prefs, places, and days.';
comment on column public.user_snapshots.updated_at is 'Snapshot clock from payload.updatedAt, used for last-write-wins.';

alter table public.user_snapshots enable row level security;

revoke all on table public.user_snapshots from public, anon, authenticated;
grant select, insert, update on table public.user_snapshots to authenticated;

create policy "Read own snapshot"
  on public.user_snapshots
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Insert own snapshot"
  on public.user_snapshots
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Update own snapshot"
  on public.user_snapshots
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
