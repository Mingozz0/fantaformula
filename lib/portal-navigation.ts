export function homeUrl(leagueId?: string, tab?: string, message?: string, raceId?: number, outcome: 'success' | 'error' = 'error') {
  const params = new URLSearchParams();
  if (leagueId) params.set('league', leagueId);
  if (tab) params.set('tab', tab);
  if (message) { params.set('message', message); params.set('outcome', outcome); }
  if (raceId) params.set('race', String(raceId));
  return params.size ? `/home?${params}` : '/home';
}
