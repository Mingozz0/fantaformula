import type { DraftPayload } from './result-draft';

export type ImportDriver = { id: number; first_name: string; last_name: string; legacy_key: string | null;
  short_name: string | null; constructor_id: number };
export type ImportConstructor = { constructor_id: number; display_name: string; canonical_name: string };
export type ResultImport = { drivers: DraftPayload['drivers']; fastest_driver_id: number | null;
  source: { name: 'Jolpica-F1'; url: string; imported_at: string; year: number; round: number; event: 'gp' | 'sprint' };
  warnings: string[]; total: number };
export type ImportReply = { ok: true; result: ResultImport } | { ok: false; error: string };

type JsonObject = Record<string, unknown>;
const object = (value: unknown): JsonObject => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};
const string = (value: unknown) => typeof value === 'string' ? value : '';
const normalized = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const position = (value: unknown) => {
  if (!/^[1-9]\d*$/.test(string(value))) return null;
  const number = Number(value);
  return number <= 30 ? number : null;
};

export function resultImportUrl(year: number, round: number, event: 'gp' | 'sprint') {
  if (!Number.isSafeInteger(year) || year < 1950 || year > 2100 || !Number.isSafeInteger(round) || round < 1 || round > 40
    || !['gp', 'sprint'].includes(event)) throw new Error('Gara non valida.');
  return `https://api.jolpi.ca/ergast/f1/${year}/${round}/${event === 'gp' ? 'results' : 'sprint'}.json?limit=100`;
}

function resultStatus(row: JsonObject): string | null {
  const status = string(row.status).toLowerCase();
  const classification = string(row.positionText).toUpperCase();
  if (/did not start|did not qualify|did not prequalify|withdrawn|107%/.test(status) || ['W', 'F'].includes(classification)) return 'dns';
  if (/disqualified|excluded/.test(status) || classification === 'D') return 'dsq';
  // Classification is authoritative: a late retirement can have status "Lapped".
  if (['R', 'N'].includes(classification) || status === 'retired') return 'dnf';
  if ((status === 'finished' || status === 'lapped' || /^\+\d+ laps?$/.test(status)) && position(row.position)) return 'finished';
  return null;
}

function constructorMatch(row: JsonObject, constructors: ImportConstructor[]) {
  const external = object(row.Constructor);
  const id = normalized(string(external.constructorId));
  const aliases: Record<string, string[]> = { rb: ['racingbulls', 'rbf1team'], redbull: ['redbull', 'redbullracing'],
    haas: ['haas', 'haasf1team'], alpine: ['alpine', 'alpinef1team'] };
  const keys = new Set([id, normalized(string(external.name)), ...(aliases[id] ?? [])].filter(Boolean));
  const matches = constructors.filter((entry) => keys.has(normalized(entry.display_name)) || keys.has(normalized(entry.canonical_name)));
  return matches.length === 1 ? matches[0].constructor_id : null;
}

export function parseResultImport(data: unknown, year: number, round: number, event: 'gp' | 'sprint',
  drivers: ImportDriver[], constructors: ImportConstructor[], importedAt = new Date().toISOString()): ResultImport {
  const url = resultImportUrl(year, round, event);
  const mr = object(object(data).MRData);
  const table = object(mr.RaceTable);
  const races = table.Races;
  if (!Array.isArray(races)) throw new Error('Risposta del servizio non valida. Riprova tra poco.');
  if (races.length === 0) throw new Error('Risultati non ancora disponibili per questa gara.');
  const race = object(races[0]);
  if (races.length !== 1 || Number(race.season) !== year || Number(race.round) !== round) throw new Error('Il servizio ha restituito una gara diversa. Importazione annullata.');
  const externalRows = race[event === 'gp' ? 'Results' : 'SprintResults'];
  if (!Array.isArray(externalRows)) throw new Error('Risposta del servizio non valida. Riprova tra poco.');
  if (externalRows.length === 0) throw new Error('Risultati non ancora disponibili per questa gara.');
  if (externalRows.length > 50 || Number(mr.total) !== externalRows.length) throw new Error('Il servizio ha restituito risultati incompleti. Riprova tra poco.');
  const imported: DraftPayload['drivers'] = [];
  const warnings: string[] = [];
  const matched = new Set<number>();
  const externalIds = new Set<string>();
  let fastest: number | null = null;
  for (const value of externalRows) {
    const row = object(value);
    const external = object(row.Driver);
    const externalId = string(external.driverId);
    if (!externalId || externalIds.has(externalId)) throw new Error('Il servizio ha restituito piloti duplicati o non validi. Importazione annullata.');
    externalIds.add(externalId);
    const name = `${string(external.givenName)} ${string(external.familyName)}`.trim() || externalId;
    const direct = drivers.filter((driver) => driver.legacy_key === externalId || driver.legacy_key?.replace(/^f1_\d{4}_/, '') === externalId);
    const matches = direct.length ? direct : drivers.filter((driver) => normalized(driver.last_name) === normalized(string(external.familyName))
      && (normalized(driver.first_name) === normalized(string(external.givenName)) || Boolean(driver.short_name && driver.short_name === external.code)));
    if (matches.length !== 1) { warnings.push(`${name}: pilota non associato al catalogo. Dati da inserire manualmente.`); continue; }
    const driver = matches[0];
    if (matched.has(driver.id)) throw new Error('Associazione dei piloti ambigua. Importazione annullata.');
    matched.add(driver.id);
    const status = resultStatus(row);
    if (!status) { warnings.push(`${name}: esito non riconosciuto (${string(row.status) || 'assente'}). Dati attuali conservati.`); continue; }
    const constructorId = constructorMatch(row, constructors);
    if (!constructorId) { warnings.push(`${name}: scuderia non riconosciuta. Dati attuali conservati.`); continue; }
    const grid = position(row.grid);
    if (grid === null && status !== 'dns') warnings.push(`${name}: griglia assente o partenza dalla corsia box. Verifica la posizione.`);
    const finish = status === 'finished' ? position(row.position) : null;
    imported.push({ driver_id: driver.id, constructor_id: constructorId, grid_position: grid, finish_position: finish,
      result_status: status, formation_lap: status !== 'dns' });
    if (Number(object(row.FastestLap).rank) === 1) {
      if (fastest !== null) throw new Error('Il servizio ha restituito più giri veloci. Importazione annullata.');
      fastest = driver.id;
    }
  }
  if (!imported.length) throw new Error('Nessun risultato associabile ai piloti della stagione. Importazione annullata.');
  // Only a complete, fully mapped classification can establish who was not entered.
  // A partial response must never clear a valid result or activate a fantasy reserve.
  const complete = imported.length === externalRows.length && externalRows.length === constructors.length * 2;
  for (const driver of drivers) if (!matched.has(driver.id)) {
    if (complete) imported.push({ driver_id: driver.id, constructor_id: driver.constructor_id,
      grid_position: null, finish_position: null, result_status: 'not_entered', formation_lap: false });
    else warnings.push(`${driver.first_name} ${driver.last_name}: risultato assente. Dati attuali conservati.`);
  }
  if (!fastest) warnings.push('Giro veloce non disponibile: verifica o completa il bonus.');
  for (const key of ['grid_position', 'finish_position'] as const) {
    const positions = imported.map((row) => row[key]).filter((value) => value !== null);
    if (new Set(positions).size !== positions.length) throw new Error('Il servizio ha restituito posizioni sovrapposte. Importazione annullata.');
  }
  return { drivers: imported, fastest_driver_id: fastest, total: externalRows.length, warnings,
    source: { name: 'Jolpica-F1', url, imported_at: importedAt, year, round, event } };
}

export function mergeResultImport(payload: DraftPayload, imported: ResultImport): DraftPayload {
  const byDriver = new Map(imported.drivers.map((driver) => [driver.driver_id, driver]));
  const existing = new Set(payload.drivers.map((driver) => driver.driver_id));
  const bonus = (id: number | null) => id && byDriver.get(id)?.result_status === 'not_entered' ? null : id;
  return { ...payload, drivers: [...payload.drivers.map((driver) => byDriver.get(driver.driver_id) ?? driver),
    ...imported.drivers.filter((driver) => !existing.has(driver.driver_id))],
    fastest_driver_id: imported.fastest_driver_id ?? bonus(payload.fastest_driver_id),
    dotd_driver_id: bonus(payload.dotd_driver_id), imported: imported.source };
}
