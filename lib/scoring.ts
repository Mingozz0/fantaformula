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

export type ScoreComponent = { label: string; points: number };
export type ScoreBreakdown = { total: number; components: ScoreComponent[]; explanation?: string };

export function explainDriverScore(result: DriverResult | undefined, rules: ScoringRules, sprint: boolean): ScoreBreakdown {
  if (!result) return { total: 0, components: [], explanation: 'Risultato del pilota non disponibile.' };
  if (result.result_status === 'dns') return { total: 0, components: [], explanation: 'Non è partito: nessun punto.' };
  if (!result.formation_lap) return { total: 0, components: [], explanation: 'Non ha preso parte al giro di formazione: nessun punto.' };
  if (result.result_status === 'dnf' || result.result_status === 'dsq') {
    const penalty = sprint ? rules.sprint_retirement : rules.gp_retirement;
    return { total: penalty, components: [{ label: result.result_status === 'dnf' ? 'Penalità per ritiro' : 'Penalità per squalifica', points: penalty }],
      explanation: 'Si applica soltanto la penalità prevista dal regolamento.' };
  }
  if (result.result_status !== 'finished' || result.finish_position === null) return { total: 0, components: [], explanation: 'Nessun piazzamento valido per il calcolo dei punti.' };
  const finishPoints = sprint ? rules.sprint_finish_points : rules.gp_finish_points;
  const gridPoints = sprint ? rules.sprint_grid_points : rules.gp_grid_points;
  const movement = result.grid_position === null ? 0 :
    (result.grid_position - result.finish_position) *
    (sprint ? rules.sprint_position_delta : rules.gp_position_delta);
  const delta = result.grid_position === null ? null : result.grid_position - result.finish_position;
  const components: ScoreComponent[] = [
    { label: `Arrivo al ${result.finish_position}º posto`, points: finishPoints[result.finish_position - 1] ?? 0 },
    { label: result.grid_position === null ? 'Griglia non disponibile' : `Partenza dal ${result.grid_position}º posto`, points: result.grid_position === null ? 0 : (gridPoints[result.grid_position - 1] ?? 0) },
    { label: delta === null ? 'Variazione di posizione non calcolabile' : delta === 0 ? 'Posizione mantenuta' : `${Math.abs(delta)} ${Math.abs(delta) === 1 ? 'posizione' : 'posizioni'} ${delta > 0 ? (Math.abs(delta) === 1 ? 'guadagnata' : 'guadagnate') : (Math.abs(delta) === 1 ? 'persa' : 'perse')}`, points: movement },
  ];
  if (result.fastest_lap) components.push({ label: 'Bonus giro veloce', points: sprint ? rules.sprint_fastest_lap : rules.gp_fastest_lap });
  if (!sprint && result.driver_of_the_day) components.push({ label: 'Bonus pilota del giorno', points: rules.driver_of_the_day });
  return { total: components.reduce((sum, component) => sum + component.points, 0), components };
}

export function scoreDriver(result: DriverResult | undefined, rules: ScoringRules, sprint: boolean): number {
  return explainDriverScore(result, rules, sprint).total;
}

export function explainConstructorScore(constructorId: number, results: DriverResult[], rules: ScoringRules,
  sprint: boolean, fastestPitConstructorId: number | null = null): ScoreBreakdown {
  const bestFinish = results
    .filter((result) => result.constructor_id === constructorId && result.result_status === 'finished' && result.finish_position !== null)
    .reduce<number | null>((best, result) => best === null || result.finish_position! < best ? result.finish_position : best, null);
  const finishPoints = sprint ? rules.sprint_finish_points : rules.gp_finish_points;
  const components: ScoreComponent[] = [{ label: bestFinish === null ? 'Nessun pilota della scuderia arrivato' : `Miglior arrivo della scuderia: ${bestFinish}º posto`, points: bestFinish === null ? 0 : (finishPoints[bestFinish - 1] ?? 0) }];
  if (!sprint && fastestPitConstructorId === constructorId) components.push({ label: 'Bonus miglior sosta ai box', points: rules.fastest_pit_stop });
  return { total: components.reduce((sum, component) => sum + component.points, 0), components };
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
    const result = byDriver.get(selected[i]);
    if (result?.result_status === 'dns' || result?.formation_lap === false) {
      selected[i] = lineup.reserve_driver_id;
      reserveUsed = true;
      break;
    }
  }
  const driverScores = selected.map((id) => scoreDriver(byDriver.get(id), rules, sprint));
  const constructorScore = explainConstructorScore(constructorId, results, rules, sprint, fastestPitConstructorId).total;
  return {
    driverIds: selected,
    driverScores,
    constructorScore,
    total: driverScores.reduce((sum, value) => sum + value, constructorScore),
    reserveUsed,
  };
}
