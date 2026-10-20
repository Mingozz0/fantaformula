import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../lib/scoring.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const loaded = { exports: {} };
new Function('module', 'exports', compiled)(loaded, loaded.exports);
const { scoreDriver, scoreEvent } = loaded.exports;

const rules = {
  gp_finish_points: [25,18,15,12,10,8,6,4,2,1],
  sprint_finish_points: [8,7,6,5,4,3,2,1],
  gp_grid_points: [10,6,3], sprint_grid_points: [5,3,1],
  gp_position_delta: 2, sprint_position_delta: 1,
  gp_fastest_lap: 5, sprint_fastest_lap: 3,
  driver_of_the_day: 5, fastest_pit_stop: 5,
  gp_retirement: -10, sprint_retirement: -5,
};
const result = (driver_id, grid_position, finish_position, extra = {}) => ({
  driver_id, constructor_id: driver_id === 3 ? 2 : 1,
  grid_position, finish_position, result_status: 'finished',
  formation_lap: true, fastest_lap: false, driver_of_the_day: false, ...extra,
});
const lineup = { driver_one_id: 1, driver_two_id: 2, reserve_driver_id: 3 };

assert.equal(scoreDriver(result(1, 3, 1, { fastest_lap: true, driver_of_the_day: true }), rules, false), 42);
assert.equal(scoreDriver(result(2, 5, 6), rules, false), 6);
assert.equal(scoreDriver(result(1, 2, 1, { fastest_lap: true }), rules, true), 15);
assert.equal(scoreDriver(result(1, 1, null, { result_status: 'dnf', fastest_lap: true }), rules, false), -10);
assert.equal(scoreDriver(result(1, 1, null, { result_status: 'dsq' }), rules, true), -5);

const gp = scoreEvent(lineup, 1, [
  result(1, 3, 1, { fastest_lap: true, driver_of_the_day: true }),
  result(2, 5, 6), result(3, 10, 8),
], rules, false, 1);
assert.equal(gp.total, 78);
assert.equal(gp.constructorScore, 30);
assert.equal(gp.reserveUsed, false);

const reserve = scoreEvent(lineup, 1, [
  result(1, 3, null, { result_status: 'dns', formation_lap: false }),
  result(2, 5, 6), result(3, 10, 8),
], rules, false);
assert.deepEqual(reserve.driverIds, [3, 2]);
assert.equal(reserve.reserveUsed, true);
assert.equal(reserve.total, 22);

const bothAbsent = scoreEvent(lineup, 1, [
  result(1, null, null, { result_status: 'dns', formation_lap: false }),
  result(2, null, null, { result_status: 'dns', formation_lap: false }),
  result(3, 10, 8),
], rules, false);
assert.deepEqual(bothAbsent.driverIds, [3, 2]);
assert.deepEqual(bothAbsent.driverScores, [8, 0]);
assert.equal(scoreEvent(null, 1, [], rules, false).total, 0);
console.log('Scoring: GP, Sprint, bonus, malus, riserva e formazione assente OK');
