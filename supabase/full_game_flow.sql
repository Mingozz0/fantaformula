-- GRIDF1 2026: authentication support, results, reserve drivers and league scoring.
-- Apply after gridf1_seed_2023_sports. Existing 2023 rows remain unchanged.

create table public.game_managers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_at timestamptz not null default now()
);
alter table public.game_managers enable row level security;
revoke all on public.game_managers from anon, authenticated;
grant select on public.game_managers to authenticated;
create policy game_managers_self on public.game_managers for select to authenticated
  using (user_id = (select auth.uid()));

create function private.is_game_manager() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.game_managers where user_id = (select auth.uid()));
$$;
revoke all on function private.is_game_manager() from public, anon;
grant execute on function private.is_game_manager() to authenticated;

create function private.create_profile_for_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(nullif(btrim(new.raw_user_meta_data->>'display_name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''), 'Pilota'), 80)
  ) on conflict (id) do nothing;
  return new;
end;
$$;
create trigger gridf1_auth_profile after insert on auth.users
for each row execute function private.create_profile_for_new_user();

alter table public.races add column race_date date;
alter table public.races add column sprint_qualifying_starts_at timestamptz;
alter table public.races add column gp_published boolean not null default false;
alter table public.races add column sprint_published boolean not null default false;

alter table public.race_driver_results add column formation_lap boolean not null default true;
alter table public.race_driver_results add column constructor_id bigint;
alter table public.race_driver_results add constraint race_result_constructor_fk
  foreign key (season_id, constructor_id)
  references public.season_constructors(season_id, constructor_id);
alter table public.sprint_driver_results add column formation_lap boolean not null default true;
alter table public.sprint_driver_results add column constructor_id bigint;
alter table public.sprint_driver_results add column fastest_lap boolean not null default false;
alter table public.sprint_driver_results add constraint sprint_result_constructor_fk
  foreign key (season_id, constructor_id)
  references public.season_constructors(season_id, constructor_id);

alter table public.lineups add column reserve_driver_id bigint;
alter table public.lineups add column retroactive boolean not null default false;
alter table public.lineups add column recorded_by uuid references auth.users(id);
alter table public.lineups add constraint lineup_reserve_season_fk
  foreign key (season_id, reserve_driver_id)
  references public.season_drivers(season_id, driver_id);
alter table public.lineups add constraint lineup_reserve_distinct
  check (reserve_driver_id is null or reserve_driver_id not in (driver_one_id, driver_two_id));

create table public.lineup_audit (
  id bigint generated always as identity primary key,
  lineup_id uuid not null,
  league_id uuid not null references public.leagues(id) on delete cascade,
  actor_id uuid references auth.users(id),
  previous_value jsonb,
  current_value jsonb,
  changed_at timestamptz not null default now()
);
create index lineup_audit_league_idx on public.lineup_audit(league_id, changed_at desc);
alter table public.lineup_audit enable row level security;
revoke all on public.lineup_audit from anon, authenticated;
grant select on public.lineup_audit to authenticated;
create policy lineup_audit_read on public.lineup_audit for select to authenticated
  using (private.is_league_admin(league_id));

create or replace function private.check_lineup() returns trigger
language plpgsql set search_path = '' as $$
declare roster public.fantasy_teams%rowtype;
declare deadline timestamptz;
declare race_year integer;
begin
  select * into roster from public.fantasy_teams where id = new.fantasy_team_id;
  if not found or new.league_id <> roster.league_id or new.season_id <> roster.season_id
    or new.driver_one_id not in (roster.driver_one_id, roster.driver_two_id, roster.driver_three_id)
    or new.driver_two_id not in (roster.driver_one_id, roster.driver_two_id, roster.driver_three_id)
    or new.reserve_driver_id is null
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

create function private.audit_lineup() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.lineup_audit(lineup_id, league_id, actor_id, previous_value, current_value)
  values (new.id, new.league_id, (select auth.uid()),
    case when tg_op = 'UPDATE' then to_jsonb(old) else null end, to_jsonb(new));
  return new;
end;
$$;
create trigger lineup_audit_write after insert or update on public.lineups
for each row execute function private.audit_lineup();

grant insert, update (driver_one_id, driver_two_id, reserve_driver_id, captain_driver_id,
  retroactive, recorded_by) on public.lineups to authenticated;
create policy lineup_admin_recovery_insert on public.lineups for insert to authenticated
  with check (retroactive and private.is_league_admin(league_id));
create policy lineup_admin_recovery_update on public.lineups for update to authenticated
  using (retroactive and private.is_league_admin(league_id))
  with check (retroactive and private.is_league_admin(league_id));

create table public.season_scoring_rules (
  season_id integer primary key references public.seasons(id),
  gp_finish_points integer[] not null,
  sprint_finish_points integer[] not null,
  gp_grid_points integer[] not null,
  sprint_grid_points integer[] not null,
  gp_position_delta integer not null,
  sprint_position_delta integer not null,
  gp_fastest_lap integer not null,
  sprint_fastest_lap integer not null,
  driver_of_the_day integer not null,
  fastest_pit_stop integer not null,
  gp_retirement integer not null,
  sprint_retirement integer not null
);
alter table public.season_scoring_rules enable row level security;
revoke all on public.season_scoring_rules from anon, authenticated;
grant select on public.season_scoring_rules to authenticated;
create policy scoring_rules_read on public.season_scoring_rules for select to authenticated using (true);

grant insert, update, delete on public.race_driver_results,
  public.sprint_driver_results, public.race_constructor_results to authenticated;
create policy manager_write on public.race_driver_results for all to authenticated
  using (private.is_game_manager()) with check (private.is_game_manager());
create policy manager_write on public.sprint_driver_results for all to authenticated
  using (private.is_game_manager()) with check (private.is_game_manager());
create policy manager_write on public.race_constructor_results for all to authenticated
  using (private.is_game_manager()) with check (private.is_game_manager());
grant update (race_date, race_starts_at, sprint_starts_at, sprint_qualifying_starts_at,
  lineup_deadline_at, gp_published, sprint_published) on public.races to authenticated;
create policy manager_races_update on public.races for update to authenticated
  using (private.is_game_manager()) with check (private.is_game_manager());

create function private.validate_result_publication() returns trigger
language plpgsql set search_path = '' as $$
declare expected_count integer;
declare actual_count integer;
begin
  select count(*) into expected_count from public.season_drivers where season_id = new.season_id;
  if new.gp_published and not old.gp_published then
    select count(*) into actual_count from public.race_driver_results where race_id = new.id;
    if actual_count <> expected_count or actual_count = 0
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
    if actual_count <> expected_count or actual_count = 0
      or exists (select 1 from public.sprint_driver_results where race_id = new.id and constructor_id is null)
      or (select count(*) from public.sprint_driver_results where race_id = new.id and fastest_lap) <> 1
      or exists (select 1 from public.sprint_driver_results where race_id = new.id and grid_position is not null group by grid_position having count(*) > 1)
      or exists (select 1 from public.sprint_driver_results where race_id = new.id and finish_position is not null group by finish_position having count(*) > 1) then
      raise exception 'Sprint results are incomplete or inconsistent';
    end if;
  end if;
  return new;
end;
$$;
create trigger result_publication before update of gp_published, sprint_published on public.races
for each row execute function private.validate_result_publication();

create function private.unpublish_changed_result() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'sprint_driver_results' then
    if tg_op = 'DELETE' then
      update public.races set sprint_published = false where id = old.race_id;
    else
      update public.races set sprint_published = false where id = new.race_id;
    end if;
  else
    if tg_op = 'DELETE' then
      update public.races set gp_published = false where id = old.race_id;
    else
      update public.races set gp_published = false where id = new.race_id;
    end if;
  end if;
  return null;
end;
$$;
create trigger gp_result_unpublish after insert or update or delete on public.race_driver_results
for each row execute function private.unpublish_changed_result();
create trigger sprint_result_unpublish after insert or update or delete on public.sprint_driver_results
for each row execute function private.unpublish_changed_result();
create trigger constructor_result_unpublish after insert or update or delete on public.race_constructor_results
for each row execute function private.unpublish_changed_result();
