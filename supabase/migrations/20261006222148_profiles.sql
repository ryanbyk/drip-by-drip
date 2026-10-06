-- Display names for optional sign-in. Reading data stays on the device until sync.
-- handle_new_user is security definer and lives in private so it is not exposed via the Data API.

create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to postgres, service_role, supabase_auth_admin;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_length check (display_name is null or char_length(display_name) <= 80)
);

comment on table public.profiles is 'Display name for the signed-in reader. Not used for authorization.';

alter table public.profiles enable row level security;

revoke all on table public.profiles from public, anon;
grant select, insert, update on table public.profiles to authenticated;

create policy "Read own profile"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "Insert own profile"
  on public.profiles
  for insert
  to authenticated
  with check ((select auth.uid()) = id);

create policy "Update own profile"
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create or replace function public.set_profiles_updated_at()
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

revoke all on function public.set_profiles_updated_at() from public, anon;
grant execute on function public.set_profiles_updated_at() to authenticated;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_profiles_updated_at();

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    nullif(
      left(
        btrim(
          coalesce(
            new.raw_user_meta_data ->> 'full_name',
            new.raw_user_meta_data ->> 'name',
            ''
          )
        ),
        80
      ),
      ''
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;
grant execute on function private.handle_new_user() to supabase_auth_admin;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function private.handle_new_user();
