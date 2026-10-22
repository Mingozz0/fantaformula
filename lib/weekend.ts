export const sessionLabels = { fp1: 'Prove libere 1', fp2: 'Prove libere 2', fp3: 'Prove libere 3',
  sprint_qualifying: 'Qualifiche Sprint', sprint: 'Sprint', qualifying: 'Qualifiche', race: 'Gran Premio' } as const;
export type SessionKey = keyof typeof sessionLabels;
export type RaceSession = { race_id: number; session_key: SessionKey; starts_at: string; source_url: string; synced_at: string };
export type WeekendRace = { id: number; round: number; name: string; circuit: string; external_circuit_id?: string | null; race_date: string | null;
  race_starts_at: string | null; sprint_starts_at: string | null; sprint_qualifying_starts_at: string | null;
  lineup_deadline_at: string | null; has_sprint: boolean; gp_published: boolean; sprint_published: boolean };
export function romeDate(now: number) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  return ['year', 'month', 'day'].map((type) => parts.find((part) => part.type === type)?.value).join('-');
}
export function weekendRace<T extends { race_date: string | null; race_starts_at?: string | null; round: number }>(races: T[], now: number): T | undefined {
  const ordered = races.toSorted((a,b) => a.round-b.round);
  const today = romeDate(now);
  return ordered.find((race) => (race.race_starts_at ? romeDate(Date.parse(race.race_starts_at)) : race.race_date ?? '') >= today) ?? ordered.at(-1);
}
export function countdownParts(target: string | null, now: number) {
  const remaining = target ? Date.parse(target) - now : NaN;
  if (!Number.isFinite(remaining)) return null;
  const seconds = Math.max(0, Math.ceil(remaining / 1000));
  return { closed: remaining <= 0, days: Math.floor(seconds / 86400), hours: Math.floor(seconds / 3600) % 24,
    minutes: Math.floor(seconds / 60) % 60, seconds: seconds % 60 };
}
export function sessionTime(value: string | null) {
  return value ? new Intl.DateTimeFormat('it-IT', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' }).format(new Date(value)) : 'Orario da confermare';
}
