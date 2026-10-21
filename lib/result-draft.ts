export type DraftDriver = { driver_id: number; constructor_id: number | null; grid_position: number | null;
  finish_position: number | null; result_status: string; formation_lap: boolean };
export type DraftPayload = { drivers: DraftDriver[]; fastest_driver_id: number | null; dotd_driver_id: number | null; pit_constructor_id: number | null };
export type ResultDraft = { payload: DraftPayload; version: number; updated_at: string; published_version: number };
export type DraftReply = { ok: true; version: number; savedAt?: string; publishedVersion?: number } | { ok: false; error: string };

export function isDraftPayload(value: unknown): value is DraftPayload {
  if (!value || typeof value !== 'object') return false;
  const payload = value as DraftPayload;
  const numeric = (value: unknown) => value === null || typeof value === 'number' && Number.isFinite(value);
  return Array.isArray(payload.drivers) && payload.drivers.length <= 50
    && new Set(payload.drivers.map((row) => row?.driver_id)).size === payload.drivers.length
    && [payload.fastest_driver_id,payload.dotd_driver_id,payload.pit_constructor_id].every(numeric)
    && payload.drivers.every((row) => row && Number.isSafeInteger(row.driver_id) && row.driver_id > 0
      && numeric(row.constructor_id) && numeric(row.grid_position) && numeric(row.finish_position)
      && ['finished','dnf','dns','dsq'].includes(row.result_status) && typeof row.formation_lap === 'boolean');
}
