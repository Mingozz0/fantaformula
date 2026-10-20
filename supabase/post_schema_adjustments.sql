-- Applied after gridf1_initial_schema.
alter table public.races add column has_sprint boolean not null default false;

-- Existing Supabase project helper was executable by API roles. It is an
-- event trigger and has no reason to be called directly by app clients.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
