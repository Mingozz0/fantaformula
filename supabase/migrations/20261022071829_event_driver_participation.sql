-- Keep fantasy rosters stable while allowing additional real-world entrants.
alter table public.season_drivers add column is_replacement boolean not null default false;
alter table public.races add column external_circuit_id text;
alter table public.races add constraint races_external_circuit_id_check check (external_circuit_id ~ '^[a-z0-9_]+$');
grant update (external_circuit_id) on public.races to authenticated;

alter table public.race_driver_results drop constraint race_driver_results_result_status_check;
alter table public.race_driver_results add constraint race_driver_results_result_status_check check (result_status in ('finished','dnf','dns','dsq','other','not_entered'));
alter table public.sprint_driver_results drop constraint sprint_driver_results_result_status_check;
alter table public.sprint_driver_results add constraint sprint_driver_results_result_status_check check (result_status in ('finished','dnf','dns','dsq','other','not_entered'));
alter table public.race_driver_results add constraint race_results_not_entered_shape check (result_status<>'not_entered' or (grid_position is null and finish_position is null and not formation_lap and not fastest_lap and not driver_of_the_day));
alter table public.sprint_driver_results add constraint sprint_results_not_entered_shape check (result_status<>'not_entered' or (grid_position is null and finish_position is null and not formation_lap and not fastest_lap));

create function private.check_fantasy_driver_eligibility() returns trigger
language plpgsql set search_path='' as $$
begin
  if exists(select 1 from public.season_drivers s where s.season_id=new.season_id and s.is_replacement
    and s.driver_id in(new.driver_one_id,new.driver_two_id,new.driver_three_id)) then
    raise exception 'Replacement entrants cannot be selected in a fantasy roster';
  end if;
  return new;
end;
$$;
revoke all on function private.check_fantasy_driver_eligibility() from public,anon,authenticated;
create trigger fantasy_team_driver_eligibility before insert or update of season_id,driver_one_id,driver_two_id,driver_three_id on public.fantasy_teams for each row execute function private.check_fantasy_driver_eligibility();
create trigger team_draft_driver_eligibility before insert or update of season_id,driver_one_id,driver_two_id,driver_three_id on public.team_drafts for each row execute function private.check_fantasy_driver_eligibility();

-- Identity lookup avoids tying this migration to generated database IDs.
insert into public.season_drivers(season_id,driver_id,constructor_id,car_number,short_name,is_replacement)
select s.id,d.id,c.constructor_id,22,'TSU',true
from public.seasons s join public.season_constructors c on c.season_id=s.id
join public.constructors team on team.id=c.constructor_id
cross join public.drivers d
where s.year=2026 and d.legacy_key='tsunoda' and team.canonical_name='Racing Bulls'
on conflict(season_id,driver_id) do nothing;

create or replace function public.publish_result_draft(p_race_id bigint, p_event text, p_expected_version integer)
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
  select count(*) into expected from public.season_drivers where season_id=race.season_id and not is_replacement;
  if jsonb_array_length(draft.payload->'drivers') < expected or expected=0
    or exists(select 1 from public.season_drivers s where s.season_id=race.season_id and not s.is_replacement
      and not exists(select 1 from jsonb_to_recordset(draft.payload->'drivers') as d(driver_id bigint) where d.driver_id=s.driver_id))
    or (select count(distinct d.driver_id) from jsonb_to_recordset(draft.payload->'drivers') as d(driver_id bigint)) <> jsonb_array_length(draft.payload->'drivers')
    or exists (select 1 from jsonb_to_recordset(draft.payload->'drivers') as d(driver_id bigint,constructor_id bigint,grid_position numeric,finish_position numeric,result_status text,formation_lap boolean)
      where not exists(select 1 from public.season_drivers s where s.season_id=race.season_id and s.driver_id=d.driver_id)
      or not exists(select 1 from public.season_constructors c where c.season_id=race.season_id and c.constructor_id=d.constructor_id)
      or d.result_status is null or d.result_status not in ('finished','dnf','dns','dsq','not_entered') or d.formation_lap is null
      or (d.result_status='not_entered' and (d.grid_position is not null or d.finish_position is not null or d.formation_lap))
      or (d.result_status='finished' and d.finish_position is null) or (d.result_status<>'finished' and d.finish_position is not null)
      or (d.grid_position is not null and (d.grid_position<>trunc(d.grid_position) or d.grid_position not between 1 and 30))
      or (d.finish_position is not null and (d.finish_position<>trunc(d.finish_position) or d.finish_position not between 1 and 30)))
    or exists(select 1 from jsonb_to_recordset(draft.payload->'drivers') as d(constructor_id bigint,result_status text)
      where d.result_status<>'not_entered' group by d.constructor_id having count(*)>2)
    or fastest is null or not exists(select 1 from jsonb_to_recordset(draft.payload->'drivers') as d(driver_id bigint,result_status text) where d.driver_id=fastest and d.result_status not in ('dns','not_entered'))
    or (p_event='gp' and (dotd is null or pit is null
      or not exists(select 1 from jsonb_to_recordset(draft.payload->'drivers') as d(driver_id bigint,result_status text) where d.driver_id=dotd and d.result_status not in ('dns','not_entered'))
      or not exists(select 1 from public.season_constructors c where c.season_id=race.season_id and c.constructor_id=pit))) then
    raise exception 'DRAFT_INCOMPLETE';
  end if;
  if p_event='gp' then
    delete from public.race_driver_results where race_id=p_race_id and driver_id not in
      (select d.driver_id from jsonb_to_recordset(draft.payload->'drivers') as d(driver_id bigint));
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
    delete from public.sprint_driver_results where race_id=p_race_id and driver_id not in
      (select d.driver_id from jsonb_to_recordset(draft.payload->'drivers') as d(driver_id bigint));
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


