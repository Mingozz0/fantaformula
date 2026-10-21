import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

function load(path) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const loaded = { exports: {} };
  new Function('module', 'exports', compiled)(loaded, loaded.exports);
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
console.log('Portale: GP conservato nei redirect, posizioni uniche e intere, esiti e campi vuoti OK');
