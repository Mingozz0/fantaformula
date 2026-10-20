-- A creator can have only one league with the same normalized name per season.
create unique index leagues_creator_season_name_idx
  on public.leagues (
    created_by,
    season_id,
    lower(regexp_replace(btrim(name), '[[:space:]]+', ' ', 'g'))
  );

-- Admins can prepare rosters before the intended players have accounts.
-- Drafts do not count as assigned teams and cannot be used for lineups.
create table public.team_drafts (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null,
  season_id integer not null,
  player_name text not null check (length(btrim(player_name)) between 2 and 80),
  name text not null check (length(btrim(name)) between 2 and 80),
  constructor_id bigint not null,
  driver_one_id bigint not null,
  driver_two_id bigint not null,
  driver_three_id bigint not null,
  created_at timestamptz not null default now(),
  foreign key (league_id, season_id)
    references public.leagues(id, season_id) on delete cascade,
  foreign key (season_id, constructor_id)
    references public.season_constructors(season_id, constructor_id),
  foreign key (season_id, driver_one_id)
    references public.season_drivers(season_id, driver_id),
  foreign key (season_id, driver_two_id)
    references public.season_drivers(season_id, driver_id),
  foreign key (season_id, driver_three_id)
    references public.season_drivers(season_id, driver_id),
  check (driver_one_id <> driver_two_id
    and driver_one_id <> driver_three_id
    and driver_two_id <> driver_three_id)
);

create index team_drafts_league_idx on public.team_drafts(league_id, created_at);
alter table public.team_drafts enable row level security;
revoke all on public.team_drafts from public, anon;
grant select, insert, update, delete on public.team_drafts to authenticated;

create policy team_drafts_admin on public.team_drafts for all to authenticated
  using (private.is_league_admin(league_id))
  with check (private.is_league_admin(league_id));

-- One transaction assigns a prepared roster and removes its draft.
create function public.assign_team_draft(p_draft_id uuid, p_user_id uuid)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  draft public.team_drafts%rowtype;
  new_team_id uuid;
begin
  select * into draft from public.team_drafts where id = p_draft_id for update;
  if not found then
    raise exception 'Squadra in attesa non trovata';
  end if;
  if not private.is_league_admin(draft.league_id) then
    raise exception 'Solo l''admin puo assegnare una squadra' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.league_members
    where league_id = draft.league_id and user_id = p_user_id
  ) then
    raise exception 'Il partecipante deve prima entrare nella lega';
  end if;

  insert into public.fantasy_teams (
    league_id, season_id, user_id, name, constructor_id,
    driver_one_id, driver_two_id, driver_three_id
  ) values (
    draft.league_id, draft.season_id, p_user_id, draft.name,
    draft.constructor_id, draft.driver_one_id, draft.driver_two_id,
    draft.driver_three_id
  ) returning id into new_team_id;

  delete from public.team_drafts where id = p_draft_id;
  return new_team_id;
end;
$$;

revoke all on function public.assign_team_draft(uuid, uuid) from public, anon;
grant execute on function public.assign_team_draft(uuid, uuid) to authenticated;
