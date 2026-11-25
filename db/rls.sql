-- Row Level Security for NewsPort Express.
--
-- Every table in this schema is reached only from the Next.js server, which
-- connects as the table owner over the Supavisor pooler. Nothing in the browser
-- ever holds a Supabase key, and PostgREST is not used.
--
-- So the posture here is deny-by-default: RLS is enabled on every table and no
-- policy is created for `anon` or `authenticated`. If the project's anon key
-- ever leaks, or someone enables the auto-generated REST API, those roles can
-- still read and write nothing. Privileges are revoked as well, so access is
-- blocked by grants and by RLS independently.
--
-- Idempotent: safe to re-run after adding tables.

-- 1. Enable RLS on every table in public.
do $$
declare t text;
begin
  for t in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- 2. Take away the default PostgREST-facing grants.
do $$
declare t text;
begin
  for t in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

revoke all on all sequences in schema public from anon, authenticated;
revoke usage on schema public from anon, authenticated;

-- 3. Stop future tables from being exposed automatically.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;

-- 4. Storage: the media bucket is private. No policy is added for anon or
--    authenticated, so objects are reachable only with the service role key,
--    which is what the /media route uses. Supabase ships RLS already enabled
--    on storage.objects, so there is nothing to turn on here.
