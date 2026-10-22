CREATE OR REPLACE FUNCTION private.validate_result_publication()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare expected_count integer;
declare actual_count integer;
begin
  select count(*) into expected_count from public.season_drivers where season_id = new.season_id and not is_replacement;
  if new.gp_published and not old.gp_published then
    select count(*) into actual_count from public.race_driver_results where race_id = new.id;
    if actual_count < expected_count or actual_count = 0
      or exists(select 1 from public.season_drivers s where s.season_id=new.season_id and not s.is_replacement
        and not exists(select 1 from public.race_driver_results r where r.race_id=new.id and r.driver_id=s.driver_id))
      or exists(select 1 from public.race_driver_results where race_id=new.id and result_status<>'not_entered' group by constructor_id having count(*)>2)
      or exists (select 1 from public.race_driver_results where race_id = new.id and constructor_id is null)
      or (select count(*) from public.race_driver_results where race_id = new.id and fastest_lap) <> 1
      or (select count(*) from public.race_driver_results where race_id = new.id and driver_of_the_day) <> 1
      or (select count(*) from public.race_constructor_results where race_id = new.id and fastest_pit_stop) <> 1
      or exists (select 1 from public.race_driver_results where race_id = new.id and grid_position is not null group by grid_position having count(*) > 1)
      or exists (select 1 from public.race_driver_results where race_id = new.id and finish_position is not null group by finish_position having count(*) > 1) then
      raise exception 'Grand Prix results are incomplete or inconsistent';
    end if;
  end if;
  if new.sprint_published and not old.sprint_published then
    if not new.has_sprint then raise exception 'This race has no sprint'; end if;
    select count(*) into actual_count from public.sprint_driver_results where race_id = new.id;
    if actual_count < expected_count or actual_count = 0
      or exists(select 1 from public.season_drivers s where s.season_id=new.season_id and not s.is_replacement
        and not exists(select 1 from public.sprint_driver_results r where r.race_id=new.id and r.driver_id=s.driver_id))
      or exists(select 1 from public.sprint_driver_results where race_id=new.id and result_status<>'not_entered' group by constructor_id having count(*)>2)
      or exists (select 1 from public.sprint_driver_results where race_id = new.id and constructor_id is null)
      or (select count(*) from public.sprint_driver_results where race_id = new.id and fastest_lap) <> 1
      or exists (select 1 from public.sprint_driver_results where race_id = new.id and grid_position is not null group by grid_position having count(*) > 1)
      or exists (select 1 from public.sprint_driver_results where race_id = new.id and finish_position is not null group by finish_position having count(*) > 1) then
      raise exception 'Sprint results are incomplete or inconsistent';
    end if;
  end if;
  return new;
end;
$function$

