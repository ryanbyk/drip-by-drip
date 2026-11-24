-- Storage bucket for optional screenshots and screen recordings attached to in-app issue reports.
-- Reads are by unguessable UUID path only; no client INSERT/UPDATE/DELETE policies are granted.
-- Uploads happen exclusively via one-time signed upload URLs issued by the report-issue Edge Function.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'issue-attachments',
  'issue-attachments',
  true,
  26214400,
  array[
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'image/heic',
    'image/heif',
    'video/mp4',
    'video/quicktime',
    'video/webm'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
