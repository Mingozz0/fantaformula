// Convert only public Formula 1 sporting data from the legacy MySQL dump.
// Usage: node scripts/convert-legacy-2023.mjs <mysql-dump.sql> <seed.sql>
import { readFileSync, writeFileSync } from 'node:fs';

const [, , inputPath, outputPath] = process.argv;
if (!inputPath || !outputPath) {
  throw new Error('Usage: node scripts/convert-legacy-2023.mjs <mysql-dump.sql> <seed.sql>');
}

const source = readFileSync(inputPath, 'utf8');
const tables = new Map();
const statements = source.matchAll(/INSERT INTO `([a-z0-9_]+)` VALUES ([\s\S]*?);/g);
for (const [, name, values] of statements) {
  tables.set(name, parseTuples(values));
}

function parseTuples(input) {
  const rows = [];
  let fields = [];
  let field = '';
  let insideQuote = false;
  let escaped = false;
  let insideTuple = false;
  for (const char of input) {
    if (!insideTuple) {
      if (char === '(') {
        insideTuple = true;
        fields = [];
        field = '';
      }
      continue;
    }
    if (escaped) {
      field += char;
      escaped = false;
    } else if (insideQuote && char === '\\') {
      escaped = true;
    } else if (char === "'") {
      insideQuote = !insideQuote;
    } else if (!insideQuote && char === ',') {
      fields.push(field.trim());
      field = '';
    } else if (!insideQuote && char === ')') {
      fields.push(field.trim());
      rows.push(fields.map((value) => value === 'NULL' ? null : value));
      insideTuple = false;
    } else {
      field += char;
    }
  }
  if (insideTuple || insideQuote) throw new Error('Incomplete SQL tuple in source dump');
  return rows;
}

function sql(value) {
  if (value === null || value === undefined || value === '') return 'null';
  if (typeof value === 'number') return String(value);
  return `'${String(value).replaceAll("'", "''")}'`;
}

function insert(table, columns, rows) {
  if (!rows.length) return '';
  return `insert into public.${table} (${columns.join(', ')}) values\n${rows.map((row) => `  (${row.map(sql).join(', ')})`).join(',\n')}\non conflict do nothing;\n\n`;
}

const required = ['seasons', 'drivers', 'teams', 'driver2team', 'races', 'driver2race'];
for (const name of required) {
  if (!tables.has(name)) throw new Error(`Missing ${name} in source dump`);
}

const legacyDrivers = tables.get('drivers');
const driverIds = new Map(legacyDrivers.map((row) => [row[1], row[0]]));
const resultRows = tables.get('driver2race').map((row) => {
  const driverId = driverIds.get(row[1]);
  if (!driverId) throw new Error(`Unknown legacy driver ${row[1]}`);
  const numericFinish = /^\d+$/.test(row[4]);
  return [row[2], 1, driverId, Number(row[3]), numericFinish ? Number(row[4]) : null,
    numericFinish ? 'finished' : 'other', row[5] === '1', row[6] === '1'];
});

const driverById = new Map(legacyDrivers.map((row) => [row[0], row]));
const lines = [
  '-- Generated from the 2023 sporting rows of formula_one_20260201.sql.',
  '-- No legacy user or password data is copied.',
  '-- Dates absent from the source remain NULL. N.C. maps to result_status=other.',
  '',
  insert('seasons', ['id', 'year'], tables.get('seasons').map((row) => [Number(row[0]), Number(row[1])])),
  insert('drivers', ['id', 'legacy_key', 'first_name', 'last_name', 'nationality', 'birth_date'],
    legacyDrivers.map((row) => [Number(row[0]), row[1], row[2], row[3], row[4], row[7]])),
  insert('constructors', ['id', 'legacy_key', 'canonical_name'],
    tables.get('teams').map((row) => [Number(row[0]), `legacy_team_${row[0]}`, row[1]])),
  insert('season_constructors', ['season_id', 'constructor_id', 'display_name'],
    tables.get('teams').map((row) => [1, Number(row[0]), row[1]])),
  insert('season_drivers', ['season_id', 'driver_id', 'constructor_id', 'car_number', 'short_name'],
    tables.get('driver2team').map((row) => {
      const driver = driverById.get(row[1]);
      if (!driver) throw new Error(`Unknown driver ID ${row[1]}`);
      return [Number(row[3]), Number(row[1]), Number(row[2]), Number(driver[6]), driver[5]];
    })),
  insert('races', ['id', 'season_id', 'round', 'name', 'circuit', 'city', 'country', 'has_sprint'],
    tables.get('races').map((row) => [Number(row[0]), Number(row[5]), Number(row[6]), row[1], row[2], row[3], row[4], row[9] === '1'])),
  insert('race_driver_results', ['race_id', 'season_id', 'driver_id', 'grid_position', 'finish_position', 'result_status', 'fastest_lap', 'driver_of_the_day'], resultRows),
  insert('race_constructor_results', ['race_id', 'season_id', 'constructor_id', 'fastest_pit_stop'],
    (tables.get('race2team') || []).map((row) => [Number(row[2]), 1, Number(row[1]), row[8] === '1'])),
  "select setval(pg_get_serial_sequence('public.seasons', 'id'), (select max(id) from public.seasons));",
  "select setval(pg_get_serial_sequence('public.drivers', 'id'), (select max(id) from public.drivers));",
  "select setval(pg_get_serial_sequence('public.constructors', 'id'), (select max(id) from public.constructors));",
  "select setval(pg_get_serial_sequence('public.races', 'id'), (select max(id) from public.races));",
];

writeFileSync(outputPath, lines.join('\n'), 'utf8');
console.log(`Generated ${outputPath}: ${legacyDrivers.length} drivers, ${tables.get('teams').length} constructors, ${tables.get('races').length} races, ${resultRows.length} race results.`);
