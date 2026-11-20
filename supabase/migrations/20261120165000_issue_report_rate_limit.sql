-- Server-only rate limiting for the report-issue Edge Function.
-- Stores only hashed fingerprints (never raw IPs) in the private schema,
-- and exposes a single security-definer helper callable only by service_role.

create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to postgres, service_role, supabase_auth_admin;

create table if not exists private.issue_report_hits (
  id bigint generated always as identity primary key,
  fingerprint text not null,
  created_at timestamptz not null default now(),
  constraint issue_report_hits_fingerprint_length check (char_length(fingerprint) between 8 and 128)
);

create index if not exists issue_report_hits_fingerprint_created_idx
  on private.issue_report_hits (fingerprint, created_at desc);

revoke all on table private.issue_report_hits from public, anon, authenticated;

create or replace function public.consume_issue_report_slot(
  p_fingerprint text,
  p_limit integer default 5,
  p_window_seconds integer default 900
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_window interval := make_interval(secs => greatest(p_window_seconds, 1));
  v_cutoff timestamptz := v_now - v_window;
  v_count integer;
  v_oldest timestamptz;
  v_retry_after integer := 0;
begin
  if p_fingerprint is null or char_length(btrim(p_fingerprint)) < 8 then
    raise exception 'Invalid rate limit fingerprint';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_fingerprint));

  delete from private.issue_report_hits
  where created_at < v_now - interval '24 hours';

  select count(*), min(created_at)
    into v_count, v_oldest
  from private.issue_report_hits
  where fingerprint = p_fingerprint
    and created_at >= v_cutoff;

  if v_count >= greatest(p_limit, 1) then
    if v_oldest is not null then
      v_retry_after := greatest(1, ceil(extract(epoch from ((v_oldest + v_window) - v_now)))::integer);
    else
      v_retry_after := greatest(p_window_seconds, 1);
    end if;
    return jsonb_build_object(
      'allowed', false,
      'remaining', 0,
      'retry_after_seconds', v_retry_after
    );
  end if;

  insert into private.issue_report_hits (fingerprint, created_at)
  values (p_fingerprint, v_now);

  return jsonb_build_object(
    'allowed', true,
    'remaining', greatest(greatest(p_limit, 1) - v_count - 1, 0),
    'retry_after_seconds', 0
  );
end;
$$;

revoke all on function public.consume_issue_report_slot(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_issue_report_slot(text, integer, integer) to service_role;
