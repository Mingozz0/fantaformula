create table public.race_sessions (
  race_id bigint not null references public.races(id) on delete cascade,
  session_key text not null check (session_key in ('fp1','fp2','fp3','qualifying','sprint_qualifying','sprint','race')),
  starts_at timestamptz not null,
  source_url text not null check (source_url ~ '^https://api[.]jolpi[.]ca/ergast/f1/[0-9]{4}/races[.]json[?]limit=100$'),
  synced_at timestamptz not null default now(),
  primary key (race_id,session_key)
);
alter table public.race_sessions enable row level security;
revoke all on public.race_sessions from public,anon,authenticated;
grant select,insert,update on public.race_sessions to authenticated;
create policy sessions_read on public.race_sessions for select to authenticated using (true);
create policy sessions_insert on public.race_sessions for insert to authenticated with check (private.is_game_manager());
create policy sessions_update on public.race_sessions for update to authenticated using (private.is_game_manager()) with check (private.is_game_manager());

create table public.race_change_audit (
  id bigint generated always as identity primary key,
  race_id bigint not null references public.races(id) on delete cascade,
  event text not null check (event in ('gp','sprint','calendar')),
  kind text not null check (kind in ('baseline','draft_saved','published','schedule_updated')),
  actor_id uuid references auth.users(id) on delete set null,
  previous_value jsonb,
  current_value jsonb not null,
  version integer,
  changed_at timestamptz not null default now()
);
create index race_change_audit_race_idx on public.race_change_audit(race_id,changed_at desc,id desc);
create index race_change_audit_actor_idx on public.race_change_audit(actor_id);
alter table public.race_change_audit enable row level security;
revoke all on public.race_change_audit from public,anon,authenticated;
grant select on public.race_change_audit to authenticated;
create policy race_audit_manager_read on public.race_change_audit for select to authenticated using (private.is_game_manager());

-- Existing results are a baseline, not a reconstruction of earlier edits.
insert into public.race_change_audit(race_id,event,kind,current_value,version)
select r.id,'gp','baseline',jsonb_build_object(
  'drivers',(select jsonb_agg(to_jsonb(d) order by driver_id) from public.race_driver_results d where d.race_id=r.id),
  'fastest_driver_id',(select driver_id from public.race_driver_results d where d.race_id=r.id and fastest_lap limit 1),
  'dotd_driver_id',(select driver_id from public.race_driver_results d where d.race_id=r.id and driver_of_the_day limit 1),
  'pit_constructor_id',(select constructor_id from public.race_constructor_results c where c.race_id=r.id and fastest_pit_stop limit 1)),0
from public.races r where r.gp_published;
insert into public.race_change_audit(race_id,event,kind,current_value,version)
select r.id,'sprint','baseline',jsonb_build_object(
  'drivers',(select jsonb_agg(to_jsonb(d) order by driver_id) from public.sprint_driver_results d where d.race_id=r.id),
  'fastest_driver_id',(select driver_id from public.sprint_driver_results d where d.race_id=r.id and fastest_lap limit 1),
  'dotd_driver_id',null,'pit_constructor_id',null),0
from public.races r where r.sprint_published;

-- Internal triggers write the append-only audit; clients have SELECT only.
create function private.audit_result_draft_changes() returns trigger
language plpgsql security definer set search_path='' as $$
declare previous_publication jsonb;
begin
  if tg_op='INSERT' or new.payload is distinct from old.payload then
    insert into public.race_change_audit(race_id,event,kind,actor_id,previous_value,current_value,version)
    values(new.race_id,new.event,'draft_saved',(select auth.uid()),case when tg_op='UPDATE' then old.payload else null end,new.payload,new.version);
  end if;
  if tg_op='UPDATE' and new.published_version is distinct from old.published_version and new.published_version>0 then
    select current_value into previous_publication from public.race_change_audit
      where race_id=new.race_id and event=new.event and kind in ('baseline','published') order by id desc limit 1;
    insert into public.race_change_audit(race_id,event,kind,actor_id,previous_value,current_value,version)
    values(new.race_id,new.event,'published',(select auth.uid()),previous_publication,new.payload,new.published_version);
  end if;
  return new;
end; $$;
revoke all on function private.audit_result_draft_changes() from public,anon,authenticated;
create trigger result_draft_changes after insert or update on public.result_drafts
  for each row execute function private.audit_result_draft_changes();

create function private.audit_schedule_changes() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_op='INSERT' or new.starts_at is distinct from old.starts_at then
    insert into public.race_change_audit(race_id,event,kind,actor_id,previous_value,current_value)
    values(new.race_id,'calendar','schedule_updated',(select auth.uid()),case when tg_op='UPDATE' then to_jsonb(old) else null end,to_jsonb(new));
  end if;
  return new;
end; $$;
revoke all on function private.audit_schedule_changes() from public,anon,authenticated;
create trigger schedule_changes after insert or update on public.race_sessions
  for each row execute function private.audit_schedule_changes();

create function private.audit_deadline_changes() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.lineup_deadline_at is distinct from old.lineup_deadline_at then
    insert into public.race_change_audit(race_id,event,kind,actor_id,previous_value,current_value)
    values(new.id,'calendar','schedule_updated',(select auth.uid()),
      jsonb_build_object('session_key','deadline','starts_at',old.lineup_deadline_at),
      jsonb_build_object('session_key','deadline','starts_at',new.lineup_deadline_at));
  end if;
  return new;
end; $$;
revoke all on function private.audit_deadline_changes() from public,anon,authenticated;
create trigger deadline_changes after update of lineup_deadline_at on public.races
  for each row execute function private.audit_deadline_changes();

create function public.sync_race_schedule(p_race_id bigint,p_sessions jsonb,p_source_url text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare race public.races%rowtype;
declare sq timestamptz;
begin
  if not private.is_game_manager() then raise exception 'Only game managers may update schedules'; end if;
  select * into race from public.races where id=p_race_id for update;
  if not found or race.race_date is null then raise exception 'Invalid race'; end if;
  if p_sessions is null or jsonb_typeof(p_sessions)<>'array' or jsonb_array_length(p_sessions) not between 1 and 7
    or p_source_url is null or p_source_url !~ '^https://api[.]jolpi[.]ca/ergast/f1/[0-9]{4}/races[.]json[?]limit=100$'
    or (select count(distinct s.session_key) from jsonb_to_recordset(p_sessions) s(session_key text,starts_at timestamptz))<>jsonb_array_length(p_sessions)
    or exists(select 1 from jsonb_to_recordset(p_sessions) s(session_key text,starts_at timestamptz)
      where s.session_key is null or s.session_key not in ('fp1','fp2','fp3','qualifying','sprint_qualifying','sprint','race')
        or s.starts_at is null or (s.starts_at at time zone 'UTC')::date not between race.race_date-4 and race.race_date+1
        or (not race.has_sprint and s.session_key in ('sprint','sprint_qualifying')))
    or not exists(select 1 from jsonb_to_recordset(p_sessions) s(session_key text) where s.session_key='race') then
    raise exception 'Invalid schedule';
  end if;
  insert into public.race_sessions(race_id,session_key,starts_at,source_url)
    select p_race_id,s.session_key,s.starts_at,p_source_url from jsonb_to_recordset(p_sessions) s(session_key text,starts_at timestamptz)
    on conflict(race_id,session_key) do update set starts_at=excluded.starts_at,source_url=excluded.source_url,synced_at=now();
  select starts_at into sq from public.race_sessions where race_id=p_race_id and session_key='sprint_qualifying';
  update public.races set
    race_starts_at=(select starts_at from public.race_sessions where race_id=p_race_id and session_key='race'),
    sprint_starts_at=coalesce((select starts_at from public.race_sessions where race_id=p_race_id and session_key='sprint'),sprint_starts_at),
    sprint_qualifying_starts_at=coalesce(sq,sprint_qualifying_starts_at),
    lineup_deadline_at=case when race.has_sprint and sq>now() and (race.lineup_deadline_at is null or race.lineup_deadline_at>now()) then sq else race.lineup_deadline_at end
    where id=p_race_id;
  return jsonb_build_object('count',jsonb_array_length(p_sessions));
end; $$;
revoke all on function public.sync_race_schedule(bigint,jsonb,text) from public,anon;
grant execute on function public.sync_race_schedule(bigint,jsonb,text) to authenticated;
