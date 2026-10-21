export function homeUrl(leagueId?: string, tab?: string, message?: string, raceId?: number) {
  const params = new URLSearchParams();
  if (leagueId) params.set('league', leagueId);
  if (tab) params.set('tab', tab);
  if (message) params.set('message', message);
  if (raceId) params.set('race', String(raceId));
  return params.size ? `/home?${params}` : '/home';
}
