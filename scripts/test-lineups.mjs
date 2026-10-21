import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const compile = (path) => ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
function load(path) {
  const loaded = { exports: {} };
  new Function('module', 'exports', compile(path))(loaded, loaded.exports);
  return loaded.exports;
}
const navigation = load('../lib/portal-navigation.ts');
const errors = load('../lib/query-errors.ts');
class Redirect extends Error { constructor(url) { super(url); this.url = url; } }
async function save(values, { admin = true, past = true, own = true, existing = true, failure = false } = {}) {
  let written;
  let operation;
  const catalog = {
    fantasy_teams: { id: 'team', league_id: 'league', season_id: 2, user_id: own ? 'actor' : 'other',
      driver_one_id: 1, driver_two_id: 2, driver_three_id: 3 },
    races: { season_id: 2, lineup_deadline_at: past ? '2020-01-01T00:00:00Z' : '2099-01-01T00:00:00Z' },
    league_members: { role: admin ? 'admin' : 'member' },
    lineups: existing ? { id: 'lineup' } : null,
  };
  const db = { auth: { getClaims: async () => ({ data: { claims: { sub: 'actor' } } }) }, from(table) {
    let mutation = false;
    const reply = () => ({ data: mutation ? (failure ? null : { id: 'lineup' }) : catalog[table],
      error: mutation && failure ? { message: 'Connection failed' } : null });
    const builder = {
      select() { return builder; }, eq() { return builder; },
      update(payload) { written = payload; operation = 'update'; mutation = true; return builder; },
      insert(payload) { written = payload; operation = 'insert'; mutation = true; return builder; },
      single: async () => reply(), maybeSingle: async () => reply(),
    };
    return builder;
  } };
  const loaded = { exports: {} };
  new Function('module', 'exports', 'require', compile('../app/home/actions.ts'))(loaded, loaded.exports, (name) => {
    if (name === 'next/cache') return { revalidatePath() {} };
    if (name === 'next/navigation') return { redirect(url) { throw new Redirect(url); } };
    if (name === '@/lib/supabase/server') return { createClient: async () => db };
    if (name === '@/lib/portal-navigation') return navigation;
    if (name === '@/lib/query-errors') return errors;
    throw new Error(`Unexpected dependency: ${name}`);
  });
  const form = new FormData();
  for (const [key, value] of Object.entries({ league_id: 'league', fantasy_team_id: 'team', race_id: '28', ...values })) form.set(key, value);
  let redirect;
  try { await loaded.exports.saveLineup(form); }
  catch (error) { if (!(error instanceof Redirect)) throw error; redirect = new URL(error.url, 'https://portal.test'); }
  assert.equal(redirect.searchParams.get('race'), '28', 'The selected historical round must survive both success and failure');
  return { written, operation, outcome: redirect.searchParams.get('outcome'), message: redirect.searchParams.get('message') };
}
for (const existing of [true, false]) {
  const empty = await save({ is_empty: 'true' }, { existing });
  assert.equal(empty.outcome, 'success');
  assert.equal(empty.operation, existing ? 'update' : 'insert');
  assert.equal(empty.written.is_empty, true);
  assert.equal(empty.written.driver_one_id, null);
  assert.equal(empty.written.driver_two_id, null);
  assert.equal(empty.written.reserve_driver_id, null);
  assert.equal(empty.written.retroactive, true);
}
const restored = await save({ driver_one_id: '3', driver_two_id: '1' });
assert.equal(restored.outcome, 'success');
assert.equal(restored.written.is_empty, false);
assert.equal(restored.written.reserve_driver_id, 2);
for (const values of [{}, { driver_one_id: '1' }, { driver_one_id: '1', driver_two_id: '1' }, { driver_one_id: '1', driver_two_id: '4' }]) {
  const reply = await save(values);
  assert.equal(reply.outcome, 'error'); assert.equal(reply.written, undefined);
}
assert.equal((await save({ is_empty: 'true' }, { admin: false })).written, undefined);
assert.equal((await save({ is_empty: 'true' }, { past: false, own: false })).written, undefined);
assert.equal((await save({ is_empty: 'true' }, { past: false, admin: false })).outcome, 'success');
assert.equal((await save({ is_empty: 'true' }, { failure: true })).outcome, 'error');
console.log('Formazioni: inserimento vuoto, ripristino, rosa, permessi, errore DB e giornata conservata OK');
