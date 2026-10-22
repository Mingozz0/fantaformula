-- Share submission status while protecting opponents' selections before the deadline.
create table public.lineup_submissions (
  lineup_id uuid primary key references public.lineups(id) on delete cascade,
  league_id uuid not null references public.leagues(id) on delete cascade,
  fantasy_team_id uuid not null references public.fantasy_teams(id) on delete cascade,
  race_id bigint not null references public.races(id) on delete cascade,
  is_submitted boolean not null,
  unique(fantasy_team_id,race_id)
);
create index lineup_submissions_league_race_idx on public.lineup_submissions(league_id,race_id);
create index lineup_submissions_race_idx on public.lineup_submissions(race_id);
alter table public.lineup_submissions enable row level security;
revoke all on public.lineup_submissions from public,anon,authenticated;
grant select on public.lineup_submissions to authenticated;
create policy lineup_submissions_read on public.lineup_submissions for select to authenticated
  using(private.is_league_member(league_id));
insert into public.lineup_submissions(lineup_id,league_id,fantasy_team_id,race_id,is_submitted)
select id,league_id,fantasy_team_id,race_id,not is_empty from public.lineups;

create function private.sync_lineup_submission() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  insert into public.lineup_submissions(lineup_id,league_id,fantasy_team_id,race_id,is_submitted)
  values(new.id,new.league_id,new.fantasy_team_id,new.race_id,not new.is_empty)
  on conflict(lineup_id) do update set league_id=excluded.league_id,fantasy_team_id=excluded.fantasy_team_id,
    race_id=excluded.race_id,is_submitted=excluded.is_submitted;
  return new;
end;
$$;
revoke all on function private.sync_lineup_submission() from public,anon,authenticated;
create trigger lineup_submission_sync after insert or update on public.lineups
  for each row execute function private.sync_lineup_submission();

alter policy lineups_read on public.lineups to authenticated using(
  private.is_league_member(league_id) and (
    private.is_league_admin(league_id)
    or exists(select 1 from public.fantasy_teams ft where ft.id=lineups.fantasy_team_id and ft.user_id=(select auth.uid()))
    or exists(select 1 from public.races r where r.id=lineups.race_id and r.lineup_deadline_at<=now())
  )
);
