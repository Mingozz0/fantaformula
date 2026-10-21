import type { SessionKey, WeekendRace } from './weekend';
const object = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown) => typeof value === 'string' ? value : '';
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
export type ScheduleImport = { raceId: number; sessions: { session_key: SessionKey; starts_at: string }[]; sourceUrl: string };
export function calendarUrl(year: number) {
  if (!Number.isInteger(year) || year < 1950 || year > 2100) throw new Error('Stagione non valida.');
  return `https://api.jolpi.ca/ergast/f1/${year}/races.json?limit=100`;
}
export async function fetchCalendar(year: number): Promise<unknown> {
  let response: Response;
  try { response = await fetch(calendarUrl(year), { headers: { 'User-Agent': 'GRIDF1/1.0', Accept: 'application/json' },
    next: { revalidate: 3600 }, signal: AbortSignal.timeout(12000) }); }
  catch { throw new Error('Calendario non raggiungibile. Gli orari salvati sono conservati.'); }
  if (!response.ok) throw new Error(response.status === 429 ? 'Troppe richieste al calendario. Riprova più tardi.' : 'Calendario temporaneamente non disponibile.');
  try { return await response.json(); } catch { throw new Error('Risposta del calendario non valida.'); }
}
export function parseSchedule(data: unknown, year: number, race: Pick<WeekendRace,'id'|'round'|'circuit'|'race_date'|'has_sprint'>): ScheduleImport {
  const mr = object(object(data).MRData);
  const rows = object(mr.RaceTable).Races;
  if (!Array.isArray(rows) || Number(mr.total) !== rows.length) throw new Error('Calendario incompleto. Nessun orario modificato.');
  const found = rows.map(object).filter((row) => Number(row.season) === year && Number(row.round) === race.round);
  if (found.length !== 1) throw new Error('Gara non trovata nel calendario.');
  const row = found[0];
  if (normalize(text(object(row.Circuit).circuitName)) !== normalize(race.circuit)) throw new Error('Circuito diverso dal catalogo: verifica la gara prima di aggiornare gli orari.');
  if (!race.race_date || Math.abs(Date.parse(text(row.date))-Date.parse(race.race_date)) > 86400000) throw new Error('Data della gara diversa dal catalogo. Nessun orario modificato.');
  const sessions: ScheduleImport['sessions'] = [];
  for (const [field, key] of [['FirstPractice','fp1'],['SecondPractice','fp2'],['ThirdPractice','fp3'],['SprintQualifying','sprint_qualifying'],['Sprint','sprint'],['Qualifying','qualifying'],['Race','race']] as const) {
    const value = field === 'Race' ? row : object(row[field]);
    if (!value.time || !value.date) continue;
    const timestamp = `${text(value.date)}T${text(value.time)}`;
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(timestamp) || !Number.isFinite(Date.parse(timestamp))) throw new Error('Orario non valido nel calendario.');
    if (!race.has_sprint && ['sprint','sprint_qualifying'].includes(key)) throw new Error('Formato Sprint diverso dal catalogo.');
    sessions.push({session_key:key,starts_at:new Date(timestamp).toISOString()});
  }
  if (!sessions.some((session)=>session.session_key==='race')) throw new Error('Orario del GP non ancora disponibile.');
  return {raceId:race.id,sessions,sourceUrl:calendarUrl(year)};
}
