-- An explicit missing submission is retained in history and scores zero.
alter table public.lineups add column is_empty boolean not null default false;
alter table public.lineups alter column driver_one_id drop not null;
alter table public.lineups alter column driver_two_id drop not null;
alter table public.lineups add constraint lineups_submission_shape check (
  (is_empty and driver_one_id is null and driver_two_id is null
    and reserve_driver_id is null and captain_driver_id is null)
  or (not is_empty and driver_one_id is not null and driver_two_id is not null
    and reserve_driver_id is not null and driver_one_id <> driver_two_id
    and reserve_driver_id not in (driver_one_id, driver_two_id))
);

create or replace function private.check_lineup()
returns trigger language plpgsql set search_path = '' as $$
declare
  roster public.fantasy_teams%rowtype;
  deadline timestamptz;
  race_year integer;
begin
  select * into roster from public.fantasy_teams where id = new.fantasy_team_id;
  if not found or new.league_id <> roster.league_id or new.season_id <> roster.season_id then
    raise exception 'Team, league and season do not match';
  end if;
  if new.is_empty then
    if new.driver_one_id is not null or new.driver_two_id is not null
      or new.reserve_driver_id is not null or new.captain_driver_id is not null then
      raise exception 'An empty lineup cannot contain drivers';
    end if;
  elsif new.driver_one_id is null or new.driver_two_id is null or new.reserve_driver_id is null
    or new.driver_one_id = new.driver_two_id
    or new.driver_one_id not in (roster.driver_one_id, roster.driver_two_id, roster.driver_three_id)
    or new.driver_two_id not in (roster.driver_one_id, roster.driver_two_id, roster.driver_three_id)
    or new.reserve_driver_id not in (roster.driver_one_id, roster.driver_two_id, roster.driver_three_id)
    or new.reserve_driver_id in (new.driver_one_id, new.driver_two_id) then
    raise exception 'A lineup needs two starters and the remaining roster driver as reserve';
  end if;
  select r.lineup_deadline_at, s.year into deadline, race_year
  from public.races r join public.seasons s on s.id = r.season_id
  where r.id = new.race_id and r.season_id = new.season_id;
  if not found then raise exception 'Race and season do not match'; end if;
  if race_year = 2026 and new.captain_driver_id is not null then
    raise exception 'Captain scoring is not enabled in 2026';
  end if;
  if new.retroactive then
    if not private.is_league_admin(new.league_id) or deadline is null or now() < deadline then
      raise exception 'Only league admins may recover a past lineup';
    end if;
  elsif deadline is null or now() >= deadline then
    raise exception 'The lineup deadline is missing or has passed';
  end if;
  new.recorded_by := (select auth.uid());
  new.submitted_at := now();
  return new;
end;
$$;

grant update (is_empty) on public.lineups to authenticated;
