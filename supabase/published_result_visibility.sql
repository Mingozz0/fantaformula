-- Unpublished results are drafts visible only to the global game manager.
drop policy catalog_read on public.race_driver_results;
create policy race_results_read on public.race_driver_results for select to authenticated
  using (private.is_game_manager() or exists (
    select 1 from public.races r where r.id = race_id and r.gp_published
  ));

drop policy catalog_read on public.sprint_driver_results;
create policy sprint_results_read on public.sprint_driver_results for select to authenticated
  using (private.is_game_manager() or exists (
    select 1 from public.races r where r.id = race_id and r.sprint_published
  ));

drop policy catalog_read on public.race_constructor_results;
create policy constructor_results_read on public.race_constructor_results for select to authenticated
  using (private.is_game_manager() or exists (
    select 1 from public.races r where r.id = race_id and r.gp_published
  ));
