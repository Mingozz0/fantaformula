import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../lib/scoring.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const loaded = { exports: {} };
new Function('module', 'exports', compiled)(loaded, loaded.exports);
const { scoreDriver, scoreEvent, explainDriverScore, explainConstructorScore } = loaded.exports;

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

// DNS always activates the reserve, even if formation-lap participation is true.
const dnsAfterFormation = scoreEvent(lineup, 1, [
  result(1, 3, null, { result_status: 'dns', formation_lap: true }),
  result(2, 5, 6), result(3, 10, 8),
], rules, false);
assert.deepEqual(dnsAfterFormation.driverIds, [3, 2]);
assert.equal(dnsAfterFormation.total, 22);
const retired = scoreEvent(lineup, 1, [result(1, 3, null, { result_status: 'dnf' }), result(2, 5, 6), result(3, 10, 8)], rules, false);
assert.equal(retired.reserveUsed, false);
assert.deepEqual(retired.driverIds, [1, 2]);
const sprintDns = scoreEvent(lineup, 1, [result(1, 3, 1), result(2, 5, null, { result_status: 'dns' }), result(3, 10, 8)], rules, true);
assert.deepEqual(sprintDns.driverIds, [1, 3]);
assert.equal(sprintDns.reserveUsed, true);

const bothAbsent = scoreEvent(lineup, 1, [
  result(1, null, null, { result_status: 'dns', formation_lap: false }),
  result(2, null, null, { result_status: 'dns', formation_lap: false }),
  result(3, 10, 8),
], rules, false);
assert.deepEqual(bothAbsent.driverIds, [3, 2]);
assert.deepEqual(bothAbsent.driverScores, [8, 0]);
assert.equal(scoreEvent(null, 1, [], rules, false).total, 0);
for (const sprint of [false, true]) {
  const empty = { driver_one_id: null, driver_two_id: null, reserve_driver_id: null, is_empty: true };
  const winners = [result(1, 1, 1, { fastest_lap: true }), result(2, 2, 2)];
  assert.ok(scoreEvent(lineup, 1, winners, rules, sprint, 1).total > 0);
  assert.deepEqual(scoreEvent(empty, 1, winners, rules, sprint, 1), {
    driverIds: [], driverScores: [], constructorScore: 0, total: 0, reserveUsed: false,
  });
  assert.equal(scoreEvent({ ...lineup, is_empty: true }, 1, winners, rules, sprint, 1).total, 0);
  assert.equal(scoreEvent({ ...lineup, driver_two_id: null }, 1, winners, rules, sprint, 1).total, 0);
}
const explained = explainDriverScore(result(1, 3, 1, { fastest_lap: true, driver_of_the_day: true }), rules, false);
assert.equal(explained.total, 42);
assert.deepEqual(explained.components.map((component) => component.points), [25, 3, 4, 5, 5]);
assert.equal(explained.components.reduce((sum, component) => sum + component.points, 0), explained.total);
const lostPositions = explainDriverScore(result(2, 5, 6), rules, false);
assert.deepEqual(lostPositions.components.map((component) => component.points), [8, 0, -2]);
assert.match(lostPositions.components[2].label, /persa/);
assert.equal(explainDriverScore(result(1, null, 2), rules, false).total, 18);
assert.equal(explainDriverScore(result(1, 1, null, { result_status: 'dnf', formation_lap: false }), rules, false).total, 0);
assert.equal(explainDriverScore(undefined, rules, false).total, 0);
assert.equal(explainDriverScore(result(1, 1, null, { result_status: 'dns' }), rules, false).total, 0);
assert.equal(explainDriverScore(result(1, 2, 1, { driver_of_the_day: true }), rules, true).total, 12);
const constructor = explainConstructorScore(1, [result(1, 3, 1), result(2, 5, 6)], rules, false, 1);
assert.equal(constructor.total, 30);
assert.deepEqual(constructor.components.map((component) => component.points), [25, 5]);
assert.equal(explainConstructorScore(2, [], rules, false).total, 0);
assert.equal(explainConstructorScore(1, [result(1, 3, 1)], rules, true, 1).total, 8);
console.log('Scoring: GP, Sprint, bonus, malus, riserva, formazione assente e dettaglio dei punti OK');
