import { scoreEvent, type DriverResult, type FantasyLineup, type ScoringRules } from './scoring';
import type { StatsRace, StatsTeam, TeamStats } from './league-stats';
export function buildAdvancedStats({ entries, races, lineups, gpResults, sprintResults, pitResults, rules }: {
  entries: TeamStats[]; races: StatsRace[]; lineups: (FantasyLineup & { fantasy_team_id:string; race_id:number })[];
  gpResults:(DriverResult & {race_id:number})[]; sprintResults:(DriverResult & {race_id:number})[];
  pitResults:{race_id:number;constructor_id:number;fastest_pit_stop:boolean}[]; rules:ScoringRules|null;
}) {
  const contributions = new Map<number,number>();
  const teams = entries.map((entry) => {
    let missed = 0;
    for (const race of races) {
      const lineup = lineups.find((row) => row.race_id===race.id && row.fantasy_team_id===entry.team.id);
      if (!lineup || !rules) continue;
      const pit = pitResults.find((row) => row.race_id===race.id && row.fastest_pit_stop)?.constructor_id ?? null;
      for (const sprint of [false,true]) {
        if (sprint ? !race.has_sprint || !race.sprint_published : !race.gp_published) continue;
        const rows = (sprint?sprintResults:gpResults).filter((row) => row.race_id===race.id);
        const actual = scoreEvent(lineup,entry.team.constructor_id,rows,rules,sprint,pit);
        actual.driverIds.forEach((id,index) => contributions.set(id,(contributions.get(id)??0)+actual.driverScores[index]));
        missed += Math.max(0, bestPossible(entry.team,rows,rules,sprint,pit)-actual.total);
      }
    }
    const variance = entry.races.length ? entry.races.reduce((sum,row) => sum+(row.total-entry.average)**2,0)/entry.races.length : 0;
    return { id:entry.team.id,name:entry.team.name,missed,missing:entry.missingLineups,reserves:entry.reserveUses,spread:Math.sqrt(variance) };
  });
  return { teams, drivers:[...contributions].map(([id,points]) => ({id,points})).sort((a,b) => b.points-a.points) };
}
function bestPossible(team:StatsTeam,results:DriverResult[],rules:ScoringRules,sprint:boolean,pit:number|null) {
  const roster=[team.driver_one_id,team.driver_two_id,team.driver_three_id];
  return Math.max(...roster.map((reserve,index) => {
    const starters=roster.filter((_,i) => i!==index);
    return scoreEvent({driver_one_id:starters[0],driver_two_id:starters[1],reserve_driver_id:reserve},team.constructor_id,results,rules,sprint,pit).total;
  }));
}
