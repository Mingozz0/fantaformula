-- Consolidate permissive RLS policies and index the app's primary read paths.

drop policy lineups_insert on public.lineups;
drop policy lineups_update on public.lineups;
drop policy lineup_admin_recovery_insert on public.lineups;
drop policy lineup_admin_recovery_update on public.lineups;

create policy lineups_insert on public.lineups for insert to authenticated
with check (
  (not retroactive and exists (
    select 1 from public.fantasy_teams ft
    where ft.id = fantasy_team_id and ft.user_id = (select auth.uid())
  )) or (retroactive and private.is_league_admin(league_id))
);
create policy lineups_update on public.lineups for update to authenticated
using (
  (not retroactive and exists (
    select 1 from public.fantasy_teams ft
    where ft.id = fantasy_team_id and ft.user_id = (select auth.uid())
  )) or (retroactive and private.is_league_admin(league_id))
)
with check (
  (not retroactive and exists (
    select 1 from public.fantasy_teams ft
    where ft.id = fantasy_team_id and ft.user_id = (select auth.uid())
  )) or (retroactive and private.is_league_admin(league_id))
);

drop policy manager_write on public.race_driver_results;
drop policy manager_write on public.sprint_driver_results;
drop policy manager_write on public.race_constructor_results;

create policy manager_insert on public.race_driver_results for insert to authenticated
  with check (private.is_game_manager());
create policy manager_update on public.race_driver_results for update to authenticated
  using (private.is_game_manager()) with check (private.is_game_manager());
create policy manager_delete on public.race_driver_results for delete to authenticated
  using (private.is_game_manager());
create policy manager_insert on public.sprint_driver_results for insert to authenticated
  with check (private.is_game_manager());
create policy manager_update on public.sprint_driver_results for update to authenticated
  using (private.is_game_manager()) with check (private.is_game_manager());
create policy manager_delete on public.sprint_driver_results for delete to authenticated
  using (private.is_game_manager());
create policy manager_insert on public.race_constructor_results for insert to authenticated
  with check (private.is_game_manager());
create policy manager_update on public.race_constructor_results for update to authenticated
  using (private.is_game_manager()) with check (private.is_game_manager());
create policy manager_delete on public.race_constructor_results for delete to authenticated
  using (private.is_game_manager());

create index if not exists lineups_league_race_idx on public.lineups(league_id, race_id);
create index if not exists race_driver_results_season_race_idx
  on public.race_driver_results(season_id, race_id);
create index if not exists sprint_driver_results_season_race_idx
  on public.sprint_driver_results(season_id, race_id);
create index if not exists race_constructor_results_season_race_idx
  on public.race_constructor_results(season_id, race_id);
