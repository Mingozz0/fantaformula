import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

function load(path) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const loaded = { exports: {} };
  new Function('module', 'exports', 'require', compiled)(loaded, loaded.exports, (name) => load(`../lib/${name.replace('./', '')}.ts`));
  return loaded.exports;
}
const { validatePositions } = load('../lib/result-validation.ts');
const { homeUrl } = load('../lib/portal-navigation.ts');
const row = (id, grid, finish, status = 'finished') => ({
  driver_id: id, name: `Pilota ${id}`, grid_position: grid, finish_position: finish, result_status: status,
});

assert.deepEqual(validatePositions([row(1, 1, 2), row(2, 2, 1)]), []);
assert.deepEqual(validatePositions([row(1, 1, 1), row(2, 2, null, 'dnf'), row(3, null, null, 'dns')]), []);
assert.equal(validatePositions([row(1, 1, 1), row(2, 1, 2)]).filter((error) => error.field === 'grid').length, 2);
assert.equal(validatePositions([row(1, 1, 2), row(2, 2, 2)]).filter((error) => error.field === 'finish').length, 2);
assert.equal(validatePositions([row(1, 1, 2), row(2, 2, 2)])[0].message.includes('Pilota 1 e Pilota 2'), true);
for (const invalid of [0, -1, 31, 1.5, NaN, Infinity]) {
  assert.equal(validatePositions([row(1, invalid, 1)]).some((error) => error.field === 'grid'), true);
  assert.equal(validatePositions([row(1, 1, invalid)]).some((error) => error.field === 'finish'), true);
}
assert.equal(validatePositions([row(1, 1, null)]).length, 1);
assert.deepEqual(validatePositions([row(1, null, null)], false), []);
assert.equal(validatePositions([row(1, 1, 2, 'dnf')]).length, 1);
assert.equal(validatePositions([row(1, 1, 2, 'invalid')]).some((error) => error.field === 'status'), true);

for (const message of ['Formazione passata registrata', 'Formazione non valida', 'Scadenza superata']) {
  const url = new URL(homeUrl('league-1', 'lineup', message, 4), 'https://portal.test');
  assert.equal(url.searchParams.get('race'), '4');
  assert.equal(url.searchParams.get('league'), 'league-1');
  assert.equal(url.searchParams.get('tab'), 'lineup');
}
assert.equal(homeUrl(), '/home');
assert.equal(new URL(homeUrl('league-1', 'lineup', 'Salvata', 4, 'success'), 'https://portal.test').searchParams.get('outcome'), 'success');
assert.equal(new URL(homeUrl('league-1', 'lineup', 'Non valida', 4), 'https://portal.test').searchParams.get('outcome'), 'error');
const { buildLeagueStats } = load('../lib/league-stats.ts');
const rules = { gp_finish_points: [10, 6, 3], sprint_finish_points: [3, 2, 1], gp_grid_points: [], sprint_grid_points: [],
  gp_position_delta: 0, sprint_position_delta: 0, gp_fastest_lap: 0, sprint_fastest_lap: 0, driver_of_the_day: 0,
  fastest_pit_stop: 0, gp_retirement: -5, sprint_retirement: -2 };
const teams = [1, 2, 3].map((id) => ({ id: `t${id}`, name: `Squadra ${id}`, user_id: `u${id}`, constructor_id: id === 1 ? 1 : 2,
  driver_one_id: 1, driver_two_id: 2, driver_three_id: 3 }));
const races = [1, 2, 3].map((id) => ({ id, round: id, name: `GP ${id}`, has_sprint: id === 3, gp_published: id === 1, sprint_published: id === 3 }));
const lineups = [1, 3].flatMap((race_id) => [
  { race_id, fantasy_team_id: 't1', driver_one_id: 1, driver_two_id: 2, reserve_driver_id: 3 },
  { race_id, fantasy_team_id: 't2', driver_one_id: 2, driver_two_id: 3, reserve_driver_id: 1 },
]);
const results = (race_id) => [1, 2, 3].map((driver_id) => ({ race_id, driver_id, constructor_id: driver_id === 3 ? 2 : 1,
  grid_position: driver_id, finish_position: driver_id, formation_lap: true, fastest_lap: false, result_status: 'finished' }));
const args = { teams, races, lineups, gpResults: [...results(1), ...results(2)], sprintResults: results(3), pitResults: [], rules };
const stats = buildLeagueStats(args);
assert.deepEqual(stats.map((entry) => entry.points), [34, 16, 0]);
assert.deepEqual(stats.map((entry) => entry.rank), [1, 2, 3]);
assert.equal(stats[0].average, 17);
assert.equal(stats[0].wins, 1); // Sprint-only publication does not award a weekend win.
assert.equal(stats[0].best.total, 26);
assert.equal(stats[0].gpPoints, 26);
assert.equal(stats[0].sprintPoints, 8);
assert.equal(stats[0].driverPoints + stats[0].constructorPoints, stats[0].points);
assert.equal(stats[2].missingLineups, 2);
assert.equal(stats[2].wins, 0);
assert.deepEqual(stats[0].races.map((row) => row.cumulative), [26, 34]);
assert.equal(buildLeagueStats({ ...args, rules: null })[0].races.length, 0);
assert.deepEqual(buildLeagueStats({ ...args, teams: [] }), []);
const emptyStats = buildLeagueStats({ ...args, lineups: lineups.map((lineup) => lineup.fantasy_team_id === 't1'
  ? { ...lineup, is_empty: true, driver_one_id: null, driver_two_id: null, reserve_driver_id: null } : lineup) });
const absent = emptyStats.find((entry) => entry.team.id === 't1');
assert.equal(absent.points, 0);
assert.equal(absent.constructorPoints, 0);
assert.equal(absent.missingLineups, 2);
assert.equal(absent.wins, 0);
assert.equal(absent.best, null);
const tiedTeams = teams.slice(0, 2).map((team) => ({ ...team, constructor_id: 1 }));
const tie = buildLeagueStats({ ...args, teams: tiedTeams, lineups: lineups.map((lineup) => ({ ...lineup, driver_one_id: 1, driver_two_id: 2, reserve_driver_id: 3 })) });
assert.deepEqual(tie.map((entry) => entry.rank), [1, 1]);
assert.deepEqual(tie.map((entry) => entry.wins), [1, 1]);
const negative = buildLeagueStats({ ...args, races: [races[0]], gpResults: results(1).map((result) => ({ ...result, finish_position: null, result_status: 'dnf' })) });
assert.equal(negative.find((entry) => entry.team.id === 't1').best.total, -10);
assert.equal(negative.find((entry) => entry.team.id === 't3').wins, 0);
console.log('Portale: GP conservato nei redirect, posizioni uniche e intere, esiti e campi vuoti OK');
console.log('Dashboard: totali GP/Sprint, media, pari merito, vittorie, assenze e punteggi negativi OK');
const { chartSeries } = load('../lib/chart-data.ts');
assert.deepEqual(chartSeries(stats,'gp','cumulative')[0].rows.map((row)=>row.value),[26,26]);
assert.deepEqual(chartSeries(stats,'sprint','round')[0].rows.map((row)=>row.value),[0,8]);
assert.deepEqual(chartSeries(stats,'all','position')[1].rows.map((row)=>row.value),[2,2]);
const { buildAdvancedStats } = load('../lib/advanced-stats.ts');
const advanced=buildAdvancedStats({...args,entries:stats});
assert.equal(advanced.teams.find((team)=>team.id==='t2').missed,9);
assert.equal(advanced.teams.find((team)=>team.id==='t3').missing,2);
assert.equal(advanced.drivers.reduce((sum,driver)=>sum+driver.points,0),stats.reduce((sum,entry)=>sum+entry.driverPoints,0));
const { isDraftPayload }=load('../lib/result-draft.ts');
const draft={drivers:[{driver_id:1,constructor_id:1,grid_position:null,finish_position:null,result_status:'finished',formation_lap:true}],fastest_driver_id:null,dotd_driver_id:null,pit_constructor_id:null};
assert.equal(isDraftPayload(draft),true);
assert.equal(isDraftPayload({...draft,drivers:[...draft.drivers,...draft.drivers]}),false);
assert.equal(isDraftPayload({...draft,fastest_driver_id:NaN}),false);
assert.equal(isDraftPayload({drivers:'invalid'}),false);
console.log('Bozze parziali, filtri grafici, posizioni e statistiche avanzate OK');
