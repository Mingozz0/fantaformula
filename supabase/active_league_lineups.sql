-- A recruiting or completed league cannot accept a new or edited lineup.
create function private.require_active_league_lineup() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not exists (
    select 1 from public.leagues
    where id = new.league_id and status = 'active'
  ) then
    raise exception 'The league must be active before submitting lineups';
  end if;
  return new;
end;
$$;
create trigger lineup_active_league before insert or update on public.lineups
for each row execute function private.require_active_league_lineup();
