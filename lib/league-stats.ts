import { scoreEvent, type DriverResult, type FantasyLineup, type ScoringRules } from './scoring';

export type StatsTeam = { id: string; user_id: string; name: string; constructor_id: number;
  driver_one_id: number; driver_two_id: number; driver_three_id: number };
export type StatsRace = { id: number; round: number; name: string; has_sprint: boolean; gp_published: boolean; sprint_published: boolean };
export type RacePoints = { race: StatsRace; gp: number | null; sprint: number | null; total: number;
  cumulative: number; driverPoints: number; constructorPoints: number; reserveUses: number; hasLineup: boolean; complete: boolean };
export type TeamStats = { team: StatsTeam; points: number; rank: number; average: number; wins: number;
  gpPoints: number; sprintPoints: number; driverPoints: number; constructorPoints: number;
  reserveUses: number; missingLineups: number; best: RacePoints | null; races: RacePoints[] };

export function buildLeagueStats({ teams, races, lineups, gpResults, sprintResults, pitResults, rules }: {
  teams: StatsTeam[]; races: StatsRace[];
  lineups: (FantasyLineup & { fantasy_team_id: string; race_id: number })[];
  gpResults: (DriverResult & { race_id: number })[]; sprintResults: (DriverResult & { race_id: number })[];
  pitResults: { race_id: number; constructor_id: number; fastest_pit_stop: boolean }[]; rules: ScoringRules | null;
}): TeamStats[] {
  const published = rules ? races.filter((race) => race.gp_published || (race.has_sprint && race.sprint_published)).toSorted((a, b) => a.round - b.round) : [];
  const entries = teams.map((team) => {
    let cumulative = 0;
    const results: RacePoints[] = published.map((race) => {
      const lineup = lineups.find((entry) => entry.fantasy_team_id === team.id && entry.race_id === race.id) ?? null;
      const pit = pitResults.find((entry) => entry.race_id === race.id && entry.fastest_pit_stop)?.constructor_id ?? null;
      const gp = race.gp_published ? scoreEvent(lineup, team.constructor_id, gpResults.filter((entry) => entry.race_id === race.id), rules!, false, pit) : null;
      const sprint = race.has_sprint && race.sprint_published ? scoreEvent(lineup, team.constructor_id, sprintResults.filter((entry) => entry.race_id === race.id), rules!, true) : null;
      const total = (gp?.total ?? 0) + (sprint?.total ?? 0);
      cumulative += total;
      return { race, gp: gp?.total ?? null, sprint: sprint?.total ?? null, total, cumulative,
        driverPoints: [...(gp?.driverScores ?? []), ...(sprint?.driverScores ?? [])].reduce((sum, value) => sum + value, 0),
        constructorPoints: (gp?.constructorScore ?? 0) + (sprint?.constructorScore ?? 0),
        reserveUses: Number(Boolean(gp?.reserveUsed)) + Number(Boolean(sprint?.reserveUsed)), hasLineup: Boolean(lineup),
        complete: race.gp_published && (!race.has_sprint || race.sprint_published) };
    });
    const best = results.filter((row) => row.hasLineup).reduce<RacePoints | null>((record, row) => !record || row.total > record.total ? row : record, null);
    return { team, points: cumulative, rank: 1, wins: 0, average: results.length ? cumulative / results.length : 0,
      gpPoints: results.reduce((sum, row) => sum + (row.gp ?? 0), 0), sprintPoints: results.reduce((sum, row) => sum + (row.sprint ?? 0), 0),
      driverPoints: results.reduce((sum, row) => sum + row.driverPoints, 0), constructorPoints: results.reduce((sum, row) => sum + row.constructorPoints, 0),
      reserveUses: results.reduce((sum, row) => sum + row.reserveUses, 0), missingLineups: results.filter((row) => !row.hasLineup).length,
      best, races: results };
  }).sort((a, b) => b.points - a.points || a.team.name.localeCompare(b.team.name, 'it'));
  for (const entry of entries) {
    entry.rank = 1 + entries.filter((other) => other.points > entry.points).length;
    entry.wins = entry.races.filter((row) => row.complete && row.hasLineup && !entries.some((other) => {
      const rival = other.races.find((result) => result.race.id === row.race.id);
      return rival?.hasLineup && rival.total > row.total;
    })).length;
  }
  return entries;
}
