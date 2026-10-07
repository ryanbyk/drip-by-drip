-- Minute cron that asks send-ask-push to deliver due reminders.
-- The job no-ops until Vault holds project_url, publishable_key, and push_cron_secret.
-- Those values are not stored in this migration. See the Web Push section of the README.
-- publishable_key must be the legacy anon JWT so the function gateway accepts the request.
-- push_cron_secret must match the Edge Function secret PUSH_CRON_SECRET.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

create or replace function private.invoke_send_ask_push()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  project_url text;
  publishable_key text;
  cron_secret text;
begin
  select decrypted_secret into project_url
  from vault.decrypted_secrets
  where name = 'project_url';

  select decrypted_secret into publishable_key
  from vault.decrypted_secrets
  where name = 'publishable_key';

  select decrypted_secret into cron_secret
  from vault.decrypted_secrets
  where name = 'push_cron_secret';

  if project_url is null or publishable_key is null or cron_secret is null then
    return;
  end if;

  perform net.http_post(
    url := rtrim(project_url, '/') || '/functions/v1/send-ask-push',
    body := '{"mode":"schedule"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || publishable_key,
      'x-cron-secret', cron_secret
    ),
    timeout_milliseconds := 20000
  );
end;
$$;

revoke all on function private.invoke_send_ask_push() from public, anon, authenticated;

select cron.schedule(
  'send-ask-push',
  '* * * * *',
  $$select private.invoke_send_ask_push()$$
);
