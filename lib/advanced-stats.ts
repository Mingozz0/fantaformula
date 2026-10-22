import { hasSubmittedLineup, scoreEvent, type DriverResult, type FantasyLineup, type ScoringRules } from './scoring';
import type { StatsRace, StatsTeam, TeamStats } from './league-stats';

type Lineup = FantasyLineup & { fantasy_team_id: string; race_id: number };
type Result = DriverResult & { race_id: number };
export type RoundTeam = { id: string; name: string; constructorId: number; hasLineup: boolean; total: number;
  gp: number | null; sprint: number | null; gpDrivers: number; sprintDrivers: number;
  gpConstructor: number; sprintConstructor: number; reservePoints: number;
  drivers: { id: number; gp: number | null; sprint: number | null; reserve: boolean }[] };
export type AdvancedRound = { race: StatsRace; complete: boolean; teams: RoundTeam[] };

export function buildAdvancedStats({ entries, races, lineups, gpResults, sprintResults, pitResults, rules }: {
  entries: TeamStats[]; races: StatsRace[]; lineups: Lineup[];
  gpResults: Result[]; sprintResults: Result[];
  pitResults: { race_id: number; constructor_id: number; fastest_pit_stop: boolean }[]; rules: ScoringRules | null;
}) {
  const contributions = new Map<number, number>();
  const published = races.filter((race) => rules && (race.gp_published || race.has_sprint && race.sprint_published)).toSorted((a,b) => a.round-b.round);
  const completeRaces = published.filter((race) => race.gp_published && (!race.has_sprint || race.sprint_published));
  const recentIds = new Set(completeRaces.slice(-3).map((race) => race.id));
  const missedByTeam = new Map<string, number>();
  const perfectByTeam = new Map<string, number>();
  const eligibleByTeam = new Map<string, number>();
  const rounds: AdvancedRound[] = published.map((race) => {
    const complete = race.gp_published && (!race.has_sprint || race.sprint_published);
    const gpRows = gpResults.filter((row) => row.race_id === race.id);
    const sprintRows = sprintResults.filter((row) => row.race_id === race.id);
    const pit = pitResults.find((row) => row.race_id === race.id && row.fastest_pit_stop)?.constructor_id ?? null;
    const teams = entries.map(({team}) => {
      const lineup = lineups.find((row) => row.race_id === race.id && row.fantasy_team_id === team.id) ?? null;
      const gp = race.gp_published ? scoreEvent(lineup,team.constructor_id,gpRows,rules!,false,pit) : null;
      const sprint = race.has_sprint && race.sprint_published ? scoreEvent(lineup,team.constructor_id,sprintRows,rules!,true) : null;
      const total = (gp?.total ?? 0)+(sprint?.total ?? 0);
      const driverRows: RoundTeam['drivers'] = [];
      let reservePoints = 0;
      for (const [key,score] of [['gp',gp],['sprint',sprint]] as const) {
        score?.driverIds.forEach((id,index) => {
          contributions.set(id,(contributions.get(id) ?? 0)+score.driverScores[index]);
          let row = driverRows.find((row) => row.id === id);
          if (!row) { row = { id, gp: null, sprint: null, reserve: id === lineup?.reserve_driver_id }; driverRows.push(row); }
          row[key] = score.driverScores[index];
          if (score.reserveUsed && id === lineup?.reserve_driver_id) reservePoints += score.driverScores[index];
        });
      }
      if (complete && hasSubmittedLineup(lineup)) {
        const best = bestWeekend(team,race,gpRows,sprintRows,rules!,pit);
        missedByTeam.set(team.id,(missedByTeam.get(team.id) ?? 0)+Math.max(0,best-total));
        eligibleByTeam.set(team.id,(eligibleByTeam.get(team.id) ?? 0)+1);
        if (best === total) perfectByTeam.set(team.id,(perfectByTeam.get(team.id) ?? 0)+1);
      }
      return { id:team.id,name:team.name,constructorId:team.constructor_id,hasLineup:hasSubmittedLineup(lineup),total,
        gp:gp?.total ?? null,sprint:sprint?.total ?? null,gpDrivers:gp?.driverScores.reduce((a,b) => a+b,0) ?? 0,
        sprintDrivers:sprint?.driverScores.reduce((a,b) => a+b,0) ?? 0,gpConstructor:gp?.constructorScore ?? 0,
        sprintConstructor:sprint?.constructorScore ?? 0,reservePoints,drivers:driverRows };
    });
    return { race,complete,teams };
  });
  const teams = entries.map((entry) => {
    const completeRows = entry.races.filter((row) => row.complete);
    const mean = completeRows.length ? completeRows.reduce((sum,row) => sum+row.total,0)/completeRows.length : 0;
    const variance = completeRows.length ? completeRows.reduce((sum,row) => sum+(row.total-mean)**2,0)/completeRows.length : 0;
    let winStreak=0, bestWinStreak=0, podiumStreak=0, bestPodiumStreak=0, podiums=0;
    const lastCompleteRound = completeRaces.at(-1)?.round ?? 0;
    for (const race of races.filter((race) => race.round <= lastCompleteRound).toSorted((a,b) => a.round-b.round)) {
      const round = rounds.find((round) => round.race.id === race.id && round.complete);
      const row = round?.teams.find((team) => team.id === entry.team.id);
      const rank = row?.hasLineup ? 1+round!.teams.filter((team) => team.hasLineup && team.total>row.total).length : null;
      winStreak = rank === 1 ? winStreak+1 : 0;
      podiumStreak = rank !== null && rank<=3 ? podiumStreak+1 : 0;
      if (rank !== null && rank<=3) podiums++;
      bestWinStreak = Math.max(bestWinStreak,winStreak); bestPodiumStreak = Math.max(bestPodiumStreak,podiumStreak);
    }
    return { id:entry.team.id,name:entry.team.name,missed:missedByTeam.get(entry.team.id) ?? 0,missing:entry.missingLineups,
      reserves:entry.reserveUses,reservePoints:rounds.reduce((sum,round) => sum+(round.teams.find((team) => team.id === entry.team.id)?.reservePoints ?? 0),0),
      spread:Math.sqrt(variance),recentPoints:entry.races.filter((row) => recentIds.has(row.race.id)).reduce((sum,row) => sum+row.total,0),
      perfect:perfectByTeam.get(entry.team.id) ?? 0,eligible:eligibleByTeam.get(entry.team.id) ?? 0,
      winStreak,bestWinStreak,podiumStreak,bestPodiumStreak,podiums,
      min:completeRows.length ? Math.min(...completeRows.map((row) => row.total)) : null,
      max:completeRows.length ? Math.max(...completeRows.map((row) => row.total)) : null,
      recent:completeRows.slice(-3).map((row) => ({name:row.race.name,total:row.total})) };
  });
  return { teams,rounds,recentCount:recentIds.size,completeCount:completeRaces.length,
    drivers:[...contributions].map(([id,points]) => ({id,points})).sort((a,b) => b.points-a.points) };
}

function bestWeekend(team: StatsTeam,race: StatsRace,gpRows: DriverResult[],sprintRows: DriverResult[],rules: ScoringRules,pit: number|null) {
  const roster=[team.driver_one_id,team.driver_two_id,team.driver_three_id];
  const scores:number[]=[];
  for (const one of roster) for (const two of roster) if (one!==two) {
    const lineup={driver_one_id:one,driver_two_id:two,reserve_driver_id:roster.find((id) => id!==one && id!==two)!};
    scores.push(scoreEvent(lineup,team.constructor_id,gpRows,rules,false,pit).total+
      (race.has_sprint ? scoreEvent(lineup,team.constructor_id,sprintRows,rules,true).total : 0));
  }
  return Math.max(...scores);
}
