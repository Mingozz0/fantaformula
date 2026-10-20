export type ScoringRules = {
  gp_finish_points: number[];
  sprint_finish_points: number[];
  gp_grid_points: number[];
  sprint_grid_points: number[];
  gp_position_delta: number;
  sprint_position_delta: number;
  gp_fastest_lap: number;
  sprint_fastest_lap: number;
  driver_of_the_day: number;
  fastest_pit_stop: number;
  gp_retirement: number;
  sprint_retirement: number;
};

export type DriverResult = {
  driver_id: number;
  constructor_id: number | null;
  grid_position: number | null;
  finish_position: number | null;
  result_status: string;
  formation_lap: boolean;
  fastest_lap: boolean;
  driver_of_the_day?: boolean;
};

export type FantasyLineup = {
  driver_one_id: number;
  driver_two_id: number;
  reserve_driver_id: number;
};

export type EventScore = {
  driverIds: number[];
  driverScores: number[];
  constructorScore: number;
  total: number;
  reserveUsed: boolean;
};

export function scoreDriver(result: DriverResult | undefined, rules: ScoringRules, sprint: boolean): number {
  if (!result || !result.formation_lap || result.result_status === 'dns') return 0;
  if (result.result_status === 'dnf' || result.result_status === 'dsq') {
    return sprint ? rules.sprint_retirement : rules.gp_retirement;
  }
  if (result.result_status !== 'finished' || result.finish_position === null) return 0;
  const finishPoints = sprint ? rules.sprint_finish_points : rules.gp_finish_points;
  const gridPoints = sprint ? rules.sprint_grid_points : rules.gp_grid_points;
  const movement = result.grid_position === null ? 0 :
    (result.grid_position - result.finish_position) *
    (sprint ? rules.sprint_position_delta : rules.gp_position_delta);
  return (finishPoints[result.finish_position - 1] ?? 0)
    + (result.grid_position === null ? 0 : (gridPoints[result.grid_position - 1] ?? 0))
    + movement
    + (result.fastest_lap ? (sprint ? rules.sprint_fastest_lap : rules.gp_fastest_lap) : 0)
    + (!sprint && result.driver_of_the_day ? rules.driver_of_the_day : 0);
}

export function scoreEvent(
  lineup: FantasyLineup | null,
  constructorId: number | null,
  results: DriverResult[],
  rules: ScoringRules,
  sprint: boolean,
  fastestPitConstructorId: number | null = null,
): EventScore {
  if (!lineup || constructorId === null) {
    return { driverIds: [], driverScores: [], constructorScore: 0, total: 0, reserveUsed: false };
  }
  const byDriver = new Map(results.map((result) => [result.driver_id, result]));
  const selected = [lineup.driver_one_id, lineup.driver_two_id];
  let reserveUsed = false;
  for (let i = 0; i < selected.length; i++) {
    if (byDriver.get(selected[i])?.formation_lap === false) {
      selected[i] = lineup.reserve_driver_id;
      reserveUsed = true;
      break;
    }
  }
  const driverScores = selected.map((id) => scoreDriver(byDriver.get(id), rules, sprint));
  const bestFinish = results
    .filter((result) => result.constructor_id === constructorId
      && result.result_status === 'finished' && result.finish_position !== null)
    .reduce<number | null>((best, result) =>
      best === null || result.finish_position! < best ? result.finish_position : best, null);
  const finishPoints = sprint ? rules.sprint_finish_points : rules.gp_finish_points;
  const constructorScore = (bestFinish === null ? 0 : (finishPoints[bestFinish - 1] ?? 0))
    + (!sprint && fastestPitConstructorId === constructorId ? rules.fastest_pit_stop : 0);
  return {
    driverIds: selected,
    driverScores,
    constructorScore,
    total: driverScores.reduce((sum, value) => sum + value, constructorScore),
    reserveUsed,
  };
}
