create table public.result_drafts (
  race_id bigint not null references public.races(id) on delete cascade,
  event text not null check (event in ('gp','sprint')),
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and jsonb_typeof(payload->'drivers') = 'array' and jsonb_array_length(payload->'drivers') <= 50),
  version integer not null default 1 check (version > 0),
  published_version integer not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid not null references auth.users(id),
  primary key (race_id,event)
);
create index result_drafts_updated_by_idx on public.result_drafts(updated_by);
alter table public.result_drafts enable row level security;
revoke all on public.result_drafts from public, anon, authenticated;
grant select, insert, update on public.result_drafts to authenticated;
create policy result_drafts_manager on public.result_drafts for all to authenticated
  using (private.is_game_manager()) with check (private.is_game_manager());

create function public.save_result_draft(p_race_id bigint, p_event text, p_payload jsonb, p_expected_version integer)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare current_version integer;
declare saved public.result_drafts%rowtype;
begin
  if not private.is_game_manager() then raise exception 'Only game managers may save drafts'; end if;
  perform 1 from public.races where id=p_race_id and (p_event='gp' or (p_event='sprint' and has_sprint)) for update;
  if not found then raise exception 'Invalid race or event'; end if;
  select version into current_version from public.result_drafts where race_id=p_race_id and event=p_event for update;
  if coalesce(current_version,0) <> p_expected_version then raise exception 'DRAFT_CONFLICT'; end if;
  insert into public.result_drafts(race_id,event,payload,version,updated_by)
    values(p_race_id,p_event,p_payload,1,(select auth.uid()))
    on conflict(race_id,event) do update set payload=excluded.payload,version=public.result_drafts.version+1,
      updated_at=now(),updated_by=excluded.updated_by returning * into saved;
  return jsonb_build_object('version',saved.version,'updated_at',saved.updated_at,'published_version',saved.published_version);
end;
$$;
revoke all on function public.save_result_draft(bigint,text,jsonb,integer) from public, anon;
grant execute on function public.save_result_draft(bigint,text,jsonb,integer) to authenticated;

create function public.publish_result_draft(p_race_id bigint, p_event text, p_expected_version integer)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare draft public.result_drafts%rowtype;
declare race public.races%rowtype;
declare expected integer;
declare fastest bigint;
declare dotd bigint;
declare pit bigint;
begin
  if not private.is_game_manager() then raise exception 'Only game managers may publish results'; end if;
  select * into race from public.races where id=p_race_id for update;
  if not found or p_event not in ('gp','sprint') or (p_event='sprint' and not race.has_sprint) then raise exception 'Invalid race or event'; end if;
  select * into draft from public.result_drafts where race_id=p_race_id and event=p_event for update;
  if not found or draft.version <> p_expected_version then raise exception 'DRAFT_CONFLICT'; end if;
  fastest := (draft.payload->>'fastest_driver_id')::bigint;
  dotd := (draft.payload->>'dotd_driver_id')::bigint;
  pit := (draft.payload->>'pit_constructor_id')::bigint;
  select count(*) into expected from public.season_drivers where season_id=race.season_id;
  if jsonb_array_length(draft.payload->'drivers') <> expected or expected=0
    or (select count(distinct d.driver_id) from jsonb_to_recordset(draft.payload->'drivers') as d(driver_id bigint)) <> expected
    or exists (select 1 from jsonb_to_recordset(draft.payload->'drivers') as d(driver_id bigint,constructor_id bigint,grid_position numeric,finish_position numeric,result_status text,formation_lap boolean)
      where not exists(select 1 from public.season_drivers s where s.season_id=race.season_id and s.driver_id=d.driver_id)
      or not exists(select 1 from public.season_constructors c where c.season_id=race.season_id and c.constructor_id=d.constructor_id)
      or d.result_status is null or d.result_status not in ('finished','dnf','dns','dsq') or d.formation_lap is null
      or (d.result_status='finished' and d.finish_position is null) or (d.result_status<>'finished' and d.finish_position is not null)
      or (d.grid_position is not null and (d.grid_position<>trunc(d.grid_position) or d.grid_position not between 1 and 30))
      or (d.finish_position is not null and (d.finish_position<>trunc(d.finish_position) or d.finish_position not between 1 and 30)))
    or fastest is null or not exists(select 1 from public.season_drivers s where s.season_id=race.season_id and s.driver_id=fastest)
    or (p_event='gp' and (dotd is null or pit is null
      or not exists(select 1 from public.season_drivers s where s.season_id=race.season_id and s.driver_id=dotd)
      or not exists(select 1 from public.season_constructors c where c.season_id=race.season_id and c.constructor_id=pit))) then
    raise exception 'DRAFT_INCOMPLETE';
  end if;
  if p_event='gp' then
    insert into public.race_driver_results(race_id,season_id,driver_id,constructor_id,grid_position,finish_position,result_status,formation_lap,fastest_lap,driver_of_the_day)
    select p_race_id,race.season_id,d.driver_id,d.constructor_id,d.grid_position,d.finish_position,d.result_status,d.formation_lap,d.driver_id=fastest,d.driver_id=dotd
      from jsonb_to_recordset(draft.payload->'drivers') as d(driver_id bigint,constructor_id bigint,grid_position smallint,finish_position smallint,result_status text,formation_lap boolean)
    on conflict(race_id,driver_id) do update set constructor_id=excluded.constructor_id,grid_position=excluded.grid_position,finish_position=excluded.finish_position,
      result_status=excluded.result_status,formation_lap=excluded.formation_lap,fastest_lap=excluded.fastest_lap,driver_of_the_day=excluded.driver_of_the_day;
    insert into public.race_constructor_results(race_id,season_id,constructor_id,fastest_pit_stop)
      select p_race_id,race.season_id,c.constructor_id,c.constructor_id=pit from public.season_constructors c where c.season_id=race.season_id
      on conflict(race_id,constructor_id) do update set fastest_pit_stop=excluded.fastest_pit_stop;
    update public.races set gp_published=true where id=p_race_id;
  else
    insert into public.sprint_driver_results(race_id,season_id,driver_id,constructor_id,grid_position,finish_position,result_status,formation_lap,fastest_lap)
    select p_race_id,race.season_id,d.driver_id,d.constructor_id,d.grid_position,d.finish_position,d.result_status,d.formation_lap,d.driver_id=fastest
      from jsonb_to_recordset(draft.payload->'drivers') as d(driver_id bigint,constructor_id bigint,grid_position smallint,finish_position smallint,result_status text,formation_lap boolean)
    on conflict(race_id,driver_id) do update set constructor_id=excluded.constructor_id,grid_position=excluded.grid_position,finish_position=excluded.finish_position,
      result_status=excluded.result_status,formation_lap=excluded.formation_lap,fastest_lap=excluded.fastest_lap;
    update public.races set sprint_published=true where id=p_race_id;
  end if;
  update public.result_drafts set published_version=version where race_id=p_race_id and event=p_event;
  return jsonb_build_object('version',draft.version,'published_version',draft.version);
end;
$$;
revoke all on function public.publish_result_draft(bigint,text,integer) from public, anon;
grant execute on function public.publish_result_draft(bigint,text,integer) to authenticated;
